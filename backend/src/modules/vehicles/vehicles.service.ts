import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SocketGateway } from '../socket/socket.gateway';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class VehiclesService implements OnModuleInit {
  private readonly logger = new Logger(VehiclesService.name);
  private socketGateway: SocketGateway;

  constructor(
    @InjectRepository(Vehicle)
    private vehicleRepository: Repository<Vehicle>,
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    // Inicializar vehículos semilla si no hay ninguno
    const count = await this.vehicleRepository.count();
    if (count === 0) {
      this.logger.log('Sembrando vehículos semilla...');
      const seeds = [
        {
          imei: '358899051025339',
          deviceName: 'Retropala JCB 3CX',
          deviceType: 'Retropala',
          plateNumber: 'P-109482',
          hourlyRate: 3500.0,
          currentHourmeter: 1540.2,
          status: 'online',
          latitude: 19.667232,
          longitude: -71.500243,
          ignition: true,
          battery: 85,
        },
        {
          imei: '355139000000234',
          deviceName: 'Pala Mecánica Caterpillar 924K',
          deviceType: 'Pala Mecánica',
          plateNumber: 'P-203847',
          hourlyRate: 4500.0,
          currentHourmeter: 2840.5,
          status: 'online',
          latitude: 19.668541,
          longitude: -71.498124,
          ignition: false,
          battery: 92,
        },
      ];
      for (const s of seeds) {
        const v = this.vehicleRepository.create(s);
        await this.vehicleRepository.save(v);
      }
      this.logger.log('Sembrado de vehículos completado.');
    }

    // Iniciar el simulador de GPS en tiempo real para demostración
    this.startGpsSimulation();
  }

  // Permite inyectar el SocketGateway circularmente o después de inicializar
  setSocketGateway(gateway: SocketGateway) {
    this.socketGateway = gateway;
  }

  async findAll(): Promise<Vehicle[]> {
    return this.vehicleRepository.find();
  }

  async findOne(id: string): Promise<Vehicle | null> {
    return this.vehicleRepository.findOne({ where: { id } });
  }

  async create(data: Partial<Vehicle>): Promise<Vehicle> {
    const v = this.vehicleRepository.create(data);
    return this.vehicleRepository.save(v);
  }

  async update(id: string, data: Partial<Vehicle>): Promise<Vehicle | null> {
    await this.vehicleRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.vehicleRepository.delete(id);
  }

  // --- INTEGRACIÓN Y CLIENTE PROTRACK365 API ---
  
  private generateSignature(password: string, timestamp: string): string {
    const firstMd5 = crypto.createHash('md5').update(password).digest('hex').toLowerCase();
    const stringToHash = firstMd5 + timestamp;
    return crypto.createHash('md5').update(stringToHash).digest('hex').toLowerCase();
  }

  /**
   * Intenta sincronizar las ubicaciones reales desde Protrack365.
   * Si falla (ej. Permission Denied), registra el error y continúa con la simulación.
   */
  async syncWithProtrack(): Promise<boolean> {
    const gpsSettings = await this.settingsService.getGpsSettings();
    const account = gpsSettings.account;
    const password = gpsSettings.passwordRaw;
    const baseUrl = gpsSettings.baseUrl || 'https://api.protrack365.com';

    if (!account || !password) {
      this.logger.warn('Credenciales de Protrack no configuradas en el panel de control');
      return false;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = this.generateSignature(password, timestamp);
      const authUrl = `${baseUrl}/api/authorization?time=${timestamp}&account=${encodeURIComponent(account)}&signature=${signature}`;

      const authRes = await fetch(authUrl);
      const authData = await authRes.json();

      if (authData.code !== 0) {
        this.logger.error(`Error de autenticación Protrack API (${authData.code}): ${authData.message}`);
        return false;
      }

      const token = authData.record.access_token;
      
      // Obtener vehículos registrados localmente con IMEI
      const localVehicles = await this.vehicleRepository.find();
      const imeis = localVehicles.map(v => v.imei).filter(Boolean);

      if (imeis.length === 0) return true;

      const trackUrl = `${baseUrl}/api/track?access_token=${token}&imeis=${imeis.join(',')}`;
      const trackRes = await fetch(trackUrl);
      const trackData = await trackRes.json();

      if (trackData.code !== 0) {
        this.logger.error(`Error de rastreo Protrack API (${trackData.code}): ${trackData.message}`);
        return false;
      }

      // Actualizar base de datos con coordenadas y estados reales
      const records = trackData.record || [];
      for (const rec of records) {
        const localV = localVehicles.find(v => v.imei === rec.imei);
        if (localV) {
          await this.vehicleRepository.update(localV.id, {
            latitude: rec.latitude,
            longitude: rec.longitude,
            speed: rec.speed,
            ignition: rec.accstatus === 1,
            battery: rec.battery,
            status: rec.datastatus === 2 ? 'online' : 'offline',
            lastReport: new Date(rec.hearttime * 1000),
          });
          
          // Emitir cambios por socket en tiempo real
          if (this.socketGateway) {
            this.socketGateway.emitVehicleUpdate({
              id: localV.id,
              imei: rec.imei,
              deviceName: localV.deviceName,
              latitude: rec.latitude,
              longitude: rec.longitude,
              speed: rec.speed,
              ignition: rec.accstatus === 1,
              status: rec.datastatus === 2 ? 'online' : 'offline',
            });
          }
        }
      }

      this.logger.log('Sincronización con Protrack365 completada exitosamente.');
      return true;

    } catch (error) {
      this.logger.error(`Fallo crítico al sincronizar con Protrack: ${error.message}`);
      return false;
    }
  }

  // --- SIMULADOR DE GPS PARA DEMOSTRACIÓN EN TIEMPO REAL ---
  
  private startGpsSimulation() {
    // Intentar sincronizar cada 10 segundos si el módulo está activo
    setInterval(async () => {
      // Obtener el estado del módulo de vehículos
      const modules = await this.settingsService.findAll();
      const vehModule = modules.find(m => m.id === 'vehiculos');
      const isEnabled = vehModule ? vehModule.isEnabled : true;

      if (!isEnabled) {
        return; // Módulo de vehículos desactivado, no hacer nada
      }

      const syncSuccess = await this.syncWithProtrack();
      
      // Si la sincronización falla (ej. por falta de permisos), corremos simulación de movimiento
      if (!syncSuccess) {
        await this.simulateMovement();
      }
    }, 10000); // Cada 10 segundos actualiza
  }

  private async simulateMovement() {
    const vehicles = await this.vehicleRepository.find();
    
    for (const v of vehicles) {
      // Solo simular movimiento si está "online"
      if (v.status === 'online') {
        // Generar una variación pequeña de lat/long alrededor de Las Matas de Santa Cruz
        const latDelta = (Math.random() - 0.5) * 0.0005;
        const lngDelta = (Math.random() - 0.5) * 0.0005;
        const speedChange = Math.floor(Math.random() * 25); // Velocidad aleatoria 0-25 km/h
        const acc = Math.random() > 0.15; // 85% probabilidad de ignición encendida
        
        const updatedLat = Number(v.latitude) + latDelta;
        const updatedLng = Number(v.longitude) + lngDelta;

        await this.vehicleRepository.update(v.id, {
          latitude: updatedLat,
          longitude: updatedLng,
          speed: speedChange,
          ignition: acc,
          lastReport: new Date(),
        });

        // Emitir actualización por WebSocket
        if (this.socketGateway) {
          this.socketGateway.emitVehicleUpdate({
            id: v.id,
            imei: v.imei,
            deviceName: v.deviceName,
            latitude: updatedLat,
            longitude: updatedLng,
            speed: speedChange,
            ignition: acc,
            status: v.status,
          });
        }
      }
    }
  }
}
