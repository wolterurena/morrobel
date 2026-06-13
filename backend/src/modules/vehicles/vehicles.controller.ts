import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from './entities/vehicle.entity';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  async findAll(): Promise<Vehicle[]> {
    return this.vehiclesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Vehicle | null> {
    return this.vehiclesService.findOne(id);
  }

  @Post()
  async create(@Body() data: Partial<Vehicle>): Promise<Vehicle> {
    return this.vehiclesService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<Vehicle>): Promise<Vehicle | null> {
    return this.vehiclesService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.vehiclesService.remove(id);
  }

  @Post('sync')
  async sync(): Promise<{ success: boolean }> {
    const success = await this.vehiclesService.syncWithProtrack();
    return { success };
  }
}
