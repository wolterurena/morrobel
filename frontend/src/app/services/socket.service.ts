import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket;
  private isConnectedSignal = signal<boolean>(false);
  isConnected = this.isConnectedSignal.asReadonly();

  // Subjects para eventos
  private vehicleUpdates = new Subject<any>();
  private newWorkOrders = new Subject<any>();
  private newExpenses = new Subject<any>();
  private vehiclesInit = new Subject<any>();
  private moduleStatusChanges = new Subject<any>();
  private workOrderApprovals = new Subject<any>();

  constructor() {
    this.socket = io('http://localhost:3000', {
      autoConnect: true,
      transports: ['websocket'],
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log('[SocketService] Conectado al servidor WebSocket');
      this.isConnectedSignal.set(true);
    });

    this.socket.on('disconnect', () => {
      console.log('[SocketService] Desconectado del servidor');
      this.isConnectedSignal.set(false);
    });

    this.socket.on('vehicles_init', (data) => {
      this.vehiclesInit.next(data);
    });

    this.socket.on('vehicle_update', (data) => {
      this.vehicleUpdates.next(data);
    });

    this.socket.on('work_order_added', (data) => {
      this.newWorkOrders.next(data);
    });

    this.socket.on('expense_added', (data) => {
      this.newExpenses.next(data);
    });

    this.socket.on('module_status_changed', (data) => {
      this.moduleStatusChanges.next(data);
    });

    this.socket.on('work_order_approved', (data) => {
      this.workOrderApprovals.next(data);
    });
  }

  onVehiclesInit(): Observable<any> {
    return this.vehiclesInit.asObservable();
  }

  onVehicleUpdate(): Observable<any> {
    return this.vehicleUpdates.asObservable();
  }

  onWorkOrderAdded(): Observable<any> {
    return this.newWorkOrders.asObservable();
  }

  onExpenseAdded(): Observable<any> {
    return this.newExpenses.asObservable();
  }

  onModuleStatusChanged(): Observable<any> {
    return this.moduleStatusChanges.asObservable();
  }

  onWorkOrderApproved(): Observable<any> {
    return this.workOrderApprovals.asObservable();
  }

  emit(event: string, data: any) {
    this.socket.emit(event, data);
  }
}
