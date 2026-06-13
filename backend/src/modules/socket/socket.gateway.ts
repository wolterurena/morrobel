import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { VehiclesService } from '../vehicles/vehicles.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Habilitar CORS para conectar desde el puerto de Angular
  },
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => VehiclesService))
    private vehiclesService: VehiclesService,
  ) {}

  onModuleInit() {
    // Vincular la puerta de enlace en el servicio de vehículos para enviar notificaciones
    this.vehiclesService.setSocketGateway(this);
  }

  handleConnection(client: Socket) {
    console.log(`[WebSockets] Cliente conectado: ${client.id}`);
    
    // Al conectarse, enviar el estado actual de los vehículos
    this.sendCurrentVehicles(client);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WebSockets] Cliente desconectado: ${client.id}`);
  }

  private async sendCurrentVehicles(client: Socket) {
    try {
      const vehicles = await this.vehiclesService.findAll();
      client.emit('vehicles_init', vehicles);
    } catch (e) {
      console.error('Error al inicializar vehículos por socket:', e.message);
    }
  }

  // Métodos de emisión global
  emitVehicleUpdate(data: any) {
    if (this.server) {
      this.server.emit('vehicle_update', data);
    }
  }

  emitNewWorkOrder(data: any) {
    if (this.server) {
      this.server.emit('work_order_added', data);
    }
  }

  emitNewExpense(data: any) {
    if (this.server) {
      this.server.emit('expense_added', data);
    }
  }
}
