import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './services/auth.service';
import { ApiService } from './services/api.service';
import { SocketService } from './services/socket.service';
import Swal from 'sweetalert2';
import { environment } from '../environments/environment';

function getCurrentFortnightPreset(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate();
  if (day <= 15) {
    return {
      start: `${year}-${month}-01`,
      end: `${year}-${month}-15`
    };
  } else {
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
      start: `${year}-${month}-16`,
      end: `${year}-${month}-${lastDay}`
    };
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  isProduction = environment.production;
  // Tab/vista activa: 'dashboard' | 'conduces' | 'gastos' | 'reportes'
  activeTab = signal<string>('dashboard');
  activeConfigSubTab = signal<string>('modules');
  row1Type: 'hourmeter' | 'time' = 'time';

  // Datos locales
  vehicles = signal<any[]>([]);
  workOrders = signal<any[]>([]);
  expenses = signal<any[]>([]);
  users = signal<any[]>([]);
  operators = computed(() => this.users().filter(u => u.role === 'operator'));
  systemModules = signal<any[]>([]);
  offlineQueue = signal<any[]>([]);
  reportStartDate = signal<string>(getCurrentFortnightPreset().start);
  reportEndDate = signal<string>(getCurrentFortnightPreset().end);
  pendingWorkOrders = computed(() => this.workOrders().filter(o => o.status === 'pending'));
  approvedWorkOrders = computed(() => this.workOrders().filter(o => o.status === 'approved'));
  nextConduceNumber = signal<string>('Secuencial...');
  gpsSettings = signal<any>({ baseUrl: '', account: '', passwordRaw: '' });
  gpsSuccess = '';
  gpsError = '';

  // Estados de formularios
  loginUsername = '';
  loginPassword = '';
  loginError = '';

  // Formulario de Conduce
  newConduce = {
    conduceNumber: '',
    date: new Date().toISOString().substring(0, 10),
    client: '',
    project: '',
    vehicleId: '',
    operatorNameRaw: '',
    registerType: 'hourmeter', // 'hourmeter' | 'clock'
    startHourmeter: '' as any,
    endHourmeter: '' as any,
    shift1Start: '',
    shift1End: '',
    shift2Start: '',
    shift2End: '',
    oil: 0,
    gasoil: 0,
    gasoline: 0,
    others: '',
    checkerSignature: ''
  };
  conduceError = '';
  conduceSuccess = '';

  // Formulario de Gasto
  newExpense = {
    description: '',
    amount: 0,
    date: new Date().toISOString().substring(0, 10),
    category: 'other',
    vehicleId: '',
    operatorNameRaw: ''
  };
  expenseError = '';
  expenseSuccess = '';

  // Formulario nuevo Vehículo
  newVehicle = {
    deviceName: '',
    deviceType: 'Retropala',
    plateNumber: '',
    hourlyRate: 0,
    currentHourmeter: 0,
    imei: ''
  };
  vehicleSuccess = '';
  vehicleError = '';

  // Formulario nuevo Usuario
  newUser = {
    username: '',
    name: '',
    password: '',
    role: 'operator'
  };
  userSuccess = '';
  userError = '';

  // Estados de edición CRUD
  editingVehicle = signal<any | null>(null);
  editingUser = signal<any | null>(null);

  // Estadísticas calculadas reactivamente usando Signals
  totalIncome = computed(() => {
    return this.workOrders().reduce((acc, order) => acc + Number(order.totalAmount || 0), 0);
  });

  totalExpenses = computed(() => {
    return this.expenses().reduce((acc, exp) => acc + Number(exp.amount || 0), 0);
  });

  totalProfit = computed(() => {
    return this.totalIncome() - this.totalExpenses();
  });

  totalHoursWorked = computed(() => {
    return this.workOrders().reduce((acc, order) => acc + Number(order.totalHours || 0), 0);
  });

  // Filtros reactivos por quincena / rango de fechas
  filteredWorkOrders = computed(() => {
    const start = this.reportStartDate();
    const end = this.reportEndDate();
    if (!start || !end) return this.workOrders().filter(o => o.status === 'approved');
    return this.workOrders().filter(o => 
      o.status === 'approved' && 
      o.date.toString() >= start && 
      o.date.toString() <= end
    );
  });

  filteredExpenses = computed(() => {
    const start = this.reportStartDate();
    const end = this.reportEndDate();
    if (!start || !end) return this.expenses();
    return this.expenses().filter(e => 
      e.date.toString() >= start && 
      e.date.toString() <= end
    );
  });

  filteredTotalIncome = computed(() => {
    return this.filteredWorkOrders().reduce((acc, order) => acc + Number(order.totalAmount || 0), 0);
  });

  filteredTotalExpenses = computed(() => {
    return this.filteredExpenses().reduce((acc, exp) => acc + Number(exp.amount || 0), 0);
  });

  filteredTotalHours = computed(() => {
    return this.filteredWorkOrders().reduce((acc, order) => acc + Number(order.totalHours || 0), 0);
  });

  filteredNetProfit = computed(() => {
    return this.filteredTotalIncome() - this.filteredTotalExpenses();
  });

  // Cálculos de liquidación quincenal por operador (horas trabajadas vs adelantos/préstamos recibidos)
  operatorSettlements = computed(() => {
    const settlements: Record<string, { name: string; hours: number; advances: number }> = {};
    
    // Inicializar con los operadores existentes en el sistema
    this.operators().forEach(op => {
      settlements[op.name] = { name: op.name, hours: 0, advances: 0 };
    });

    // Sumar horas trabajadas aprobadas en el rango
    this.filteredWorkOrders().forEach(order => {
      const name = order.operatorNameRaw;
      if (name) {
        if (!settlements[name]) {
          settlements[name] = { name, hours: 0, advances: 0 };
        }
        settlements[name].hours += Number(order.totalHours || 0);
      }
    });

    // Sumar adelantos/préstamos de egresos en el rango
    this.filteredExpenses()
      .filter(exp => exp.category === 'advance_loan' && exp.operatorNameRaw)
      .forEach(exp => {
        const name = exp.operatorNameRaw;
        if (!settlements[name]) {
          settlements[name] = { name, hours: 0, advances: 0 };
        }
        settlements[name].advances += Number(exp.amount || 0);
      });

    return Object.values(settlements);
  });

  setFortnightPreset(type: '1st' | '2nd' | 'full') {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    if (type === '1st') {
      this.reportStartDate.set(`${year}-${month}-01`);
      this.reportEndDate.set(`${year}-${month}-15`);
    } else if (type === '2nd') {
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      this.reportStartDate.set(`${year}-${month}-16`);
      this.reportEndDate.set(`${year}-${month}-${lastDay}`);
    } else if (type === 'full') {
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      this.reportStartDate.set(`${year}-${month}-01`);
      this.reportEndDate.set(`${year}-${month}-${lastDay}`);
    }
  }

  // Datos para reporte/desglose de gastos
  expenseCategories = computed(() => {
    const breakdown: Record<string, number> = {};
    this.expenses().forEach(e => {
      breakdown[e.category] = (breakdown[e.category] || 0) + Number(e.amount || 0);
    });
    return Object.entries(breakdown).map(([key, value]) => ({ category: key, total: value }));
  });

  constructor(
    public authService: AuthService,
    private apiService: ApiService,
    public socketService: SocketService
  ) {
    // Sincronizar estados cuando el usuario se loguea
    effect(() => {
      if (this.authService.isLoggedIn()) {
        this.fetchInitialData();
      }
    });
  }

  ngOnInit() {
    this.setupSocketListeners();
    this.offlineQueue.set(this.getOfflineQueue());

    // Sincronizar automáticamente cuando el navegador vuelva a estar online
    window.addEventListener('online', () => {
      console.log('[Network] Conexión recuperada. Sincronizando conduces offline...');
      this.syncOfflineConduces();
    });

    // Revisión periódica de internet y sincronización cada 15 segundos
    setInterval(() => {
      if (navigator.onLine) {
        this.syncOfflineConduces();
      }
    }, 15000);
  }

  // Cargar datos iniciales del API
  fetchInitialData() {
    this.apiService.getVehicles().subscribe({
      next: (data) => this.vehicles.set(data),
      error: (err) => console.error('Error al cargar vehículos:', err)
    });

    this.apiService.getWorkOrders().subscribe({
      next: (data) => this.workOrders.set(data),
      error: (err) => console.error('Error al cargar conduces:', err)
    });

    this.apiService.getExpenses().subscribe({
      next: (data) => this.expenses.set(data),
      error: (err) => console.error('Error al cargar gastos:', err)
    });

    this.apiService.getUsers().subscribe({
      next: (data) => this.users.set(data),
      error: (err) => console.error('Error al cargar usuarios:', err)
    });

    this.apiService.getSystemModules().subscribe({
      next: (data) => this.systemModules.set(data),
      error: (err) => console.error('Error al cargar módulos:', err)
    });

    this.loadNextConduceNumber();

    if (this.authService.currentUser()?.role === 'admin') {
      this.apiService.getGpsSettings().subscribe({
        next: (data) => this.gpsSettings.set(data),
        error: (err) => console.error('Error al cargar configuración GPS:', err)
      });
    }
  }

  loadNextConduceNumber() {
    this.apiService.getNextConduceNumber().subscribe({
      next: (res) => this.nextConduceNumber.set(res.nextNumber),
      error: (err) => console.error('Error al cargar siguiente conduce:', err)
    });
  }

  // Escuchar eventos en tiempo real del WebSocket
  setupSocketListeners() {
    // Carga inicial
    this.socketService.onVehiclesInit().subscribe((initVehicles) => {
      if (initVehicles && initVehicles.length > 0) {
        this.vehicles.set(initVehicles);
      }
    });

    // Actualización de ubicación/ignición de vehículo
    this.socketService.onVehicleUpdate().subscribe((updatedVehicle) => {
      const current = this.vehicles();
      const idx = current.findIndex(v => v.id === updatedVehicle.id || v.imei === updatedVehicle.imei);
      if (idx !== -1) {
        const updated = [...current];
        updated[idx] = { ...updated[idx], ...updatedVehicle };
        this.vehicles.set(updated);
      }
    });

    // Nuevo conduce registrado (entra en pendiente)
    this.socketService.onWorkOrderAdded().subscribe((newOrder) => {
      this.workOrders.set([newOrder, ...this.workOrders()]);
      this.loadNextConduceNumber();
    });

    // Conduce aprobado
    this.socketService.onWorkOrderApproved().subscribe((approvedInfo) => {
      const orders = this.workOrders();
      const idx = orders.findIndex(o => o.id === approvedInfo.id);
      if (idx !== -1) {
        const updatedOrders = [...orders];
        updatedOrders[idx] = { 
          ...updatedOrders[idx], 
          status: 'approved',
          totalHours: approvedInfo.totalHours,
          totalAmount: approvedInfo.totalAmount
        };
        this.workOrders.set(updatedOrders);
      }

      // Actualizar también el horómetro del vehículo afectado localmente
      const currentVehicles = this.vehicles();
      const vIdx = currentVehicles.findIndex(v => v.id === approvedInfo.vehicleId);
      if (vIdx !== -1) {
        const updatedVehicles = [...currentVehicles];
        updatedVehicles[vIdx].currentHourmeter = approvedInfo.endHourmeter;
        this.vehicles.set(updatedVehicles);
      }
    });

    // Nuevo gasto registrado
    this.socketService.onExpenseAdded().subscribe((newExp) => {
      this.expenses.set([newExp, ...this.expenses()]);
    });

    // Cambio de estado de módulo en tiempo real
    this.socketService.onModuleStatusChanged().subscribe((change) => {
      const current = this.systemModules();
      const idx = current.findIndex(m => m.id === change.id);
      if (idx !== -1) {
        const updated = [...current];
        updated[idx] = { ...updated[idx], isEnabled: change.isEnabled };
        this.systemModules.set(updated);

        // Si la pestaña actual se deshabilitó, redirigir al dashboard (o a config si dashboard está deshabilitado)
        if (this.activeTab() === change.id && !change.isEnabled) {
          if (change.id === 'dashboard') {
            this.activeTab.set('config');
          } else {
            this.activeTab.set('dashboard');
          }
        }
      }
    });
  }

  // --- ACTIONS ---

  onLogin() {
    this.loginError = '';
    this.authService.login(this.loginUsername, this.loginPassword).subscribe({
      next: () => {
        this.loginUsername = '';
        this.loginPassword = '';
        if (this.authService.currentUser()?.role === 'operator') {
          this.activeTab.set('conduces');
        } else {
          this.activeTab.set('dashboard');
        }
      },
      error: (err) => {
        this.loginError = err.error?.message || 'Usuario o contraseña incorrecta';
      }
    });
  }

  onLogout() {
    this.authService.logout();
  }

  // Enviar Conduce
  submitConduce() {
    this.conduceError = '';
    this.conduceSuccess = '';

    const opName = this.authService.currentUser()?.role === 'operator'
      ? this.authService.currentUser()?.name
      : this.newConduce.operatorNameRaw;

    if (!this.newConduce.client || !this.newConduce.vehicleId || !opName) {
      this.conduceError = 'Por favor complete los campos obligatorios (Cliente, Vehículo, Operador)';
      return;
    }

    const startObj = this.parseValue(this.newConduce.startHourmeter);
    const endObj = this.parseValue(this.newConduce.endHourmeter);
    if (!startObj.isTime && !endObj.isTime && endObj.value < startObj.value) {
      this.conduceError = 'El horómetro final no puede ser menor al inicial.';
      return;
    }

    const canvas = this.getCanvas();
    let signatureData = '';
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const buffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
        const isBlank = !buffer.some(color => color !== 0);
        if (!isBlank) {
          signatureData = canvas.toDataURL('image/png');
        }
      }
    }

    const calculatedHours = this.calculateFrontendTotalHours();
    const dataToSend = {
      ...this.newConduce,
      operatorNameRaw: opName,
      totalHours: calculatedHours,
      checkerSignature: signatureData,
      checkerId: this.authService.currentUser()?.id
    };

    // Si el operador está offline, guardar de inmediato en LocalStorage
    if (!navigator.onLine) {
      this.saveConduceOffline(dataToSend);
      this.conduceSuccess = '⚠️ Sin Internet. Conduce guardado localmente (Offline). Se subirá al servidor automáticamente al recuperar señal.';
      this.resetConduceForm();
      return;
    }

    this.apiService.createWorkOrder(dataToSend).subscribe({
      next: () => {
        this.conduceSuccess = '¡Conduce de trabajo registrado correctamente!';
        this.resetConduceForm();
      },
      error: (err) => {
        if (err.status === 0) {
          // Status 0 significa error de red o servidor inaccesible
          this.saveConduceOffline(dataToSend);
          this.conduceSuccess = '⚠️ Conexión perdida. Conduce guardado localmente (Offline). Sincronizando en segundo plano.';
          this.resetConduceForm();
        } else {
          this.conduceError = err.error?.message || 'Error al guardar el conduce.';
        }
      }
    });
  }

  resetConduceForm() {
    this.newConduce = {
      conduceNumber: '',
      date: new Date().toISOString().substring(0, 10),
      client: '',
      project: '',
      vehicleId: '',
      operatorNameRaw: '',
      registerType: 'hourmeter',
      startHourmeter: '' as any,
      endHourmeter: '' as any,
      shift1Start: '',
      shift1End: '',
      shift2Start: '',
      shift2End: '',
      oil: 0,
      gasoil: 0,
      gasoline: 0,
      others: '',
      checkerSignature: ''
    };
    this.clearSignature();
    setTimeout(() => this.conduceSuccess = '', 6000);
  }

  // Enviar Gasto
  submitExpense() {
    this.expenseError = '';
    this.expenseSuccess = '';

    if (!this.newExpense.description || this.newExpense.amount <= 0) {
      this.expenseError = 'Complete la descripción y asigne un monto válido.';
      return;
    }

    this.apiService.createExpense(this.newExpense).subscribe({
      next: () => {
        this.expenseSuccess = '¡Gasto operativo registrado con éxito!';
        this.newExpense = {
          description: '',
          amount: 0,
          date: new Date().toISOString().substring(0, 10),
          category: 'other',
          vehicleId: '',
          operatorNameRaw: ''
        };
        setTimeout(() => this.expenseSuccess = '', 4000);
      },
      error: (err) => {
        this.expenseError = err.error?.message || 'Error al guardar el gasto.';
      }
    });
  }

  // Sincronizar de forma manual con Protrack API
  triggerProtrackSync() {
    this.apiService.syncVehicles().subscribe({
      next: (res) => {
        console.log('Sincronización Protrack:', res);
      },
      error: (err) => {
        console.error('Error al sincronizar con Protrack API:', err);
      }
    });
  }

  // Helper para traducir categorías de gastos
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      fuel: 'Combustible',
      oil_change: 'Cambio de Aceite',
      maintenance: 'Mantenimiento Mecánico',
      washing: 'Lavado de Equipo',
      advance_loan: 'Adelanto a Operador',
      other: 'Otro Gasto'
    };
    return labels[category] || category;
  }

  getVehicleIncome(vehicleId: string): number {
    return this.workOrders()
      .filter(order => order.vehicleId === vehicleId)
      .reduce((acc, order) => acc + Number(order.totalAmount || 0), 0);
  }

  getVehicleExpenses(vehicleId: string): number {
    return this.expenses()
      .filter(exp => exp.vehicleId === vehicleId)
      .reduce((acc, exp) => acc + Number(exp.amount || 0), 0);
  }

  getVehicleIncomeFiltered(vehicleId: string): number {
    return this.filteredWorkOrders()
      .filter(order => order.vehicleId === vehicleId)
      .reduce((acc, order) => acc + Number(order.totalAmount || 0), 0);
  }

  getVehicleExpensesFiltered(vehicleId: string): number {
    return this.filteredExpenses()
      .filter(exp => exp.vehicleId === vehicleId)
      .reduce((acc, exp) => acc + Number(exp.amount || 0), 0);
  }

  isModuleEnabled(id: string): boolean {
    const mod = this.systemModules().find(m => m.id === id);
    return mod ? mod.isEnabled : true; // Habilitado por defecto si no se encuentra
  }

  toggleModule(id: string, isEnabled: boolean) {
    this.apiService.updateSystemModule(id, isEnabled).subscribe({
      next: (updated) => {
        // Actualizar estado local de inmediato
        const current = this.systemModules();
        const idx = current.findIndex(m => m.id === id);
        if (idx !== -1) {
          const updatedList = [...current];
          updatedList[idx].isEnabled = isEnabled;
          this.systemModules.set(updatedList);
        }
      },
      error: (err) => console.error('Error al actualizar módulo:', err)
    });
  }

  approveWorkOrder(id: string) {
    this.apiService.approveWorkOrder(id).subscribe({
      next: (res) => {
        console.log('Conduce aprobado y calculado:', res);
      },
      error: (err) => {
        console.error('Error al aprobar conduce:', err);
      }
    });
  }

  saveGpsSettings() {
    this.gpsSuccess = '';
    this.gpsError = '';
    this.apiService.updateGpsSettings(this.gpsSettings()).subscribe({
      next: (updated) => {
        this.gpsSettings.set(updated);
        this.gpsSuccess = 'Configuración GPS guardada correctamente y aplicada en tiempo real.';
        setTimeout(() => this.gpsSuccess = '', 4000);
      },
      error: (err) => {
        this.gpsError = err.error?.message || 'Error al guardar la configuración GPS.';
      }
    });
  }

  submitVehicle() {
    this.vehicleSuccess = '';
    this.vehicleError = '';
    if (!this.newVehicle.deviceName || this.newVehicle.hourlyRate <= 0) {
      Swal.fire({
        title: 'Atención',
        text: 'El nombre de equipo y la tarifa horaria son obligatorios.',
        icon: 'warning',
        background: '#111827',
        color: '#f3f4f6',
        confirmButtonColor: '#f59e0b',
      });
      return;
    }

    if (this.editingVehicle()) {
      this.apiService.updateVehicle(this.editingVehicle().id, this.newVehicle).subscribe({
        next: (res) => {
          this.vehicles.set(this.vehicles().map(v => v.id === res.id ? res : v));
          this.cancelEditVehicle();
          Swal.fire({
            title: '¡Actualizado!',
            text: 'Equipo de maquinaria actualizado con éxito.',
            icon: 'success',
            background: '#111827',
            color: '#f3f4f6',
            confirmButtonColor: '#f59e0b',
          });
        },
        error: (err) => {
          Swal.fire({
            title: 'Error',
            text: err.error?.message || 'Error al actualizar el equipo.',
            icon: 'error',
            background: '#111827',
            color: '#f3f4f6',
            confirmButtonColor: '#f59e0b',
          });
        }
      });
      return;
    }

    this.apiService.createVehicle(this.newVehicle).subscribe({
      next: (res) => {
        this.vehicles.set([...this.vehicles(), res]);
        this.newVehicle = {
          deviceName: '',
          deviceType: 'Retropala',
          plateNumber: '',
          hourlyRate: 0,
          currentHourmeter: 0,
          imei: ''
        };
        Swal.fire({
          title: '¡Creado!',
          text: 'Equipo de maquinaria creado con éxito.',
          icon: 'success',
          background: '#111827',
          color: '#f3f4f6',
          confirmButtonColor: '#f59e0b',
        });
      },
      error: (err) => {
        Swal.fire({
          title: 'Error',
          text: err.error?.message || 'Error al guardar el equipo.',
          icon: 'error',
          background: '#111827',
          color: '#f3f4f6',
          confirmButtonColor: '#f59e0b',
        });
      }
    });
  }

  startEditVehicle(v: any) {
    this.editingVehicle.set(v);
    this.newVehicle = {
      deviceName: v.deviceName,
      deviceType: v.deviceType,
      plateNumber: v.plateNumber || '',
      hourlyRate: v.hourlyRate,
      currentHourmeter: v.currentHourmeter || 0,
      imei: v.imei || ''
    };
    this.vehicleSuccess = '';
    this.vehicleError = '';
  }

  cancelEditVehicle() {
    this.editingVehicle.set(null);
    this.newVehicle = {
      deviceName: '',
      deviceType: 'Retropala',
      plateNumber: '',
      hourlyRate: 0,
      currentHourmeter: 0,
      imei: ''
    };
  }

  deleteVehicle(id: string) {
    Swal.fire({
      title: '¿Está seguro?',
      text: 'Esta acción no se puede deshacer. Se eliminará la maquinaria del sistema.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#111827',
      color: '#f3f4f6',
    }).then((result) => {
      if (result.isConfirmed) {
        this.apiService.deleteVehicle(id).subscribe({
          next: () => {
            this.vehicles.set(this.vehicles().filter(v => v.id !== id));
            Swal.fire({
              title: '¡Eliminado!',
              text: 'La maquinaria ha sido eliminada correctamente.',
              icon: 'success',
              background: '#111827',
              color: '#f3f4f6',
              confirmButtonColor: '#f59e0b',
            });
          },
          error: (err) => {
            Swal.fire({
              title: 'Error',
              text: err.error?.message || 'Error al eliminar maquinaria. Asegúrese de que no tenga conduces asociados.',
              icon: 'error',
              background: '#111827',
              color: '#f3f4f6',
              confirmButtonColor: '#f59e0b',
            });
          }
        });
      }
    });
  }

  submitUser() {
    this.userSuccess = '';
    this.userError = '';

    if (this.editingUser()) {
      if (!this.newUser.username || !this.newUser.name) {
        Swal.fire({
          title: 'Atención',
          text: 'El usuario y el nombre son obligatorios.',
          icon: 'warning',
          background: '#111827',
          color: '#f3f4f6',
          confirmButtonColor: '#f59e0b',
        });
        return;
      }

      const payload: any = {
        username: this.newUser.username,
        name: this.newUser.name,
        role: this.newUser.role
      };
      if (this.newUser.password) {
        payload.password = this.newUser.password;
      }

      this.apiService.updateUser(this.editingUser().id, payload).subscribe({
        next: (res) => {
          this.users.set(this.users().map(u => u.id === res.id ? res : u));
          this.cancelEditUser();
          Swal.fire({
            title: '¡Actualizado!',
            text: 'Empleado/Usuario actualizado con éxito.',
            icon: 'success',
            background: '#111827',
            color: '#f3f4f6',
            confirmButtonColor: '#f59e0b',
          });
        },
        error: (err) => {
          Swal.fire({
            title: 'Error',
            text: err.error?.message || 'Error al actualizar el empleado.',
            icon: 'error',
            background: '#111827',
            color: '#f3f4f6',
            confirmButtonColor: '#f59e0b',
          });
        }
      });
      return;
    }

    if (!this.newUser.username || !this.newUser.name || !this.newUser.password) {
      Swal.fire({
        title: 'Atención',
        text: 'El usuario, nombre y clave son obligatorios.',
        icon: 'warning',
        background: '#111827',
        color: '#f3f4f6',
        confirmButtonColor: '#f59e0b',
      });
      return;
    }
    this.apiService.createUser(this.newUser).subscribe({
      next: (res) => {
        this.users.set([...this.users(), res]);
        this.newUser = {
          username: '',
          name: '',
          password: '',
          role: 'operator'
        };
        Swal.fire({
          title: '¡Registrado!',
          text: 'Empleado/Usuario registrado con éxito.',
          icon: 'success',
          background: '#111827',
          color: '#f3f4f6',
          confirmButtonColor: '#f59e0b',
        });
      },
      error: (err) => {
        Swal.fire({
          title: 'Error',
          text: err.error?.message || 'Error al registrar el empleado.',
          icon: 'error',
          background: '#111827',
          color: '#f3f4f6',
          confirmButtonColor: '#f59e0b',
        });
      }
    });
  }

  startEditUser(u: any) {
    this.editingUser.set(u);
    this.newUser = {
      username: u.username,
      name: u.name,
      password: '',
      role: u.role
    };
    this.userSuccess = '';
    this.userError = '';
  }

  cancelEditUser() {
    this.editingUser.set(null);
    this.newUser = {
      username: '',
      name: '',
      password: '',
      role: 'operator'
    };
  }

  deleteUser(id: string) {
    Swal.fire({
      title: '¿Está seguro?',
      text: 'Esta acción no se puede deshacer. Se eliminará al empleado/usuario del sistema.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#111827',
      color: '#f3f4f6',
    }).then((result) => {
      if (result.isConfirmed) {
        this.apiService.deleteUser(id).subscribe({
          next: () => {
            this.users.set(this.users().filter(u => u.id !== id));
            Swal.fire({
              title: '¡Eliminado!',
              text: 'El empleado/usuario ha sido eliminado correctamente.',
              icon: 'success',
              background: '#111827',
              color: '#f3f4f6',
              confirmButtonColor: '#f59e0b',
            });
          },
          error: (err) => {
            Swal.fire({
              title: 'Error',
              text: err.error?.message || 'Error al eliminar empleado/usuario. Asegúrese de que no tenga conduces o gastos asociados.',
              icon: 'error',
              background: '#111827',
              color: '#f3f4f6',
              confirmButtonColor: '#f59e0b',
            });
          }
        });
      }
    });
  }

  parseValue(val: any): { isTime: boolean; value: number; timeStr: string } {
    if (val === null || val === undefined || val === '') {
      return { isTime: false, value: 0, timeStr: '' };
    }
    const str = String(val).trim().toUpperCase();
    const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/;
    const match = str.match(timeRegex);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3];
      if (ampm === 'PM' && hours < 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
      const hh = hours.toString().padStart(2, '0');
      const mm = minutes.toString().padStart(2, '0');
      return { isTime: true, value: hours + minutes / 60, timeStr: `${hh}:${mm}` };
    }
    const num = parseFloat(str);
    return { isTime: false, value: isNaN(num) ? 0 : num, timeStr: '' };
  }

  calculateFrontendTotalHours(): number {
    const startObj = this.parseValue(this.newConduce.startHourmeter);
    const endObj = this.parseValue(this.newConduce.endHourmeter);
    
    let part1Diff = 0;
    if (startObj.isTime && endObj.isTime) {
      part1Diff = endObj.value - startObj.value;
      if (part1Diff < 0) part1Diff += 24;
    } else if (!startObj.isTime && !endObj.isTime) {
      part1Diff = endObj.value - startObj.value;
      if (part1Diff < 0) part1Diff = 0;
    }
    
    const part2StartObj = this.parseValue(this.newConduce.shift2Start);
    const part2EndObj = this.parseValue(this.newConduce.shift2End);
    let part2Diff = 0;
    if (part2StartObj.isTime && part2EndObj.isTime) {
      part2Diff = part2EndObj.value - part2StartObj.value;
      if (part2Diff < 0) part2Diff += 24;
    }
    
    return Number((part1Diff + part2Diff).toFixed(2));
  }

  // Canvas Signature Methods
  isDrawing = false;
  lastX = 0;
  lastY = 0;

  getCanvas(): HTMLCanvasElement | null {
    return document.getElementById('signatureCanvas') as HTMLCanvasElement;
  }

  getCanvasCtx(): CanvasRenderingContext2D | null {
    const canvas = this.getCanvas();
    return canvas ? canvas.getContext('2d') : null;
  }

  startDrawing(e: MouseEvent) {
    this.isDrawing = true;
    const canvas = this.getCanvas();
    if (!canvas) return;
    
    // Auto-adjust internal resolution to match screen dimensions to prevent scaling issues
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      const temp = canvas.toDataURL();
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const img = new Image();
      img.src = temp;
      img.onload = () => {
        canvas.getContext('2d')?.drawImage(img, 0, 0);
      };
    }
    
    const rect = canvas.getBoundingClientRect();
    this.lastX = e.clientX - rect.left;
    this.lastY = e.clientY - rect.top;
  }

  draw(e: MouseEvent) {
    if (!this.isDrawing) return;
    const canvas = this.getCanvas();
    const ctx = this.getCanvasCtx();
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(this.lastX, this.lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#f59e0b'; // Color ámbar
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    this.lastX = x;
    this.lastY = y;
  }

  startDrawingTouch(e: TouchEvent) {
    this.isDrawing = true;
    const canvas = this.getCanvas();
    if (!canvas || e.touches.length === 0) return;
    
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      const temp = canvas.toDataURL();
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const img = new Image();
      img.src = temp;
      img.onload = () => {
        canvas.getContext('2d')?.drawImage(img, 0, 0);
      };
    }
    
    const rect = canvas.getBoundingClientRect();
    this.lastX = e.touches[0].clientX - rect.left;
    this.lastY = e.touches[0].clientY - rect.top;
    e.preventDefault();
  }

  drawTouch(e: TouchEvent) {
    if (!this.isDrawing || e.touches.length === 0) return;
    const canvas = this.getCanvas();
    const ctx = this.getCanvasCtx();
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(this.lastX, this.lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    this.lastX = x;
    this.lastY = y;
    e.preventDefault();
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  clearSignature() {
    const canvas = this.getCanvas();
    const ctx = this.getCanvasCtx();
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.newConduce.checkerSignature = '';
    }
  }

  // Métodos de Sincronización Offline First
  saveConduceOffline(conduce: any) {
    const queue = this.getOfflineQueue();
    queue.push(conduce);
    localStorage.setItem('offline_conduces', JSON.stringify(queue));
    this.offlineQueue.set(queue);
  }

  getOfflineQueue(): any[] {
    try {
      const stored = localStorage.getItem('offline_conduces');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  isSyncing = false;
  syncOfflineConduces() {
    if (this.isSyncing) return;
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return;

    this.isSyncing = true;
    console.log(`[Offline Sync] Sincronizando ${queue.length} conduces offline...`);

    const nextConduce = queue[0];
    this.apiService.createWorkOrder(nextConduce).subscribe({
      next: () => {
        console.log(`[Offline Sync] Conduce ${nextConduce.conduceNumber || 'offline'} sincronizado con éxito.`);
        const updated = queue.slice(1);
        localStorage.setItem('offline_conduces', JSON.stringify(updated));
        this.offlineQueue.set(updated);
        this.isSyncing = false;
        
        // Sincronizar el siguiente conduce en la cola
        this.syncOfflineConduces();
      },
      error: (err) => {
        console.error('[Offline Sync] Error al sincronizar conduce offline:', err);
        this.isSyncing = false;
        
        // Si no es error de red (status !== 0), significa error de validación del servidor (4xx o 5xx)
        // Lo sacamos de la cola para que un conduce corrupto no tranque la cola indefinidamente
        if (err.status !== 0) {
          const updated = queue.slice(1);
          localStorage.setItem('offline_conduces', JSON.stringify(updated));
          this.offlineQueue.set(updated);
          this.syncOfflineConduces();
        }
      }
    });
  }
}
