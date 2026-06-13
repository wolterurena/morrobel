import { Module, forwardRef } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [forwardRef(() => VehiclesModule)], // Evitar referencia circular
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule {}
