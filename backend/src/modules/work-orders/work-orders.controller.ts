import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrder } from './entities/work-order.entity';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get()
  async findAll(): Promise<WorkOrder[]> {
    return this.workOrdersService.findAll();
  }

  @Get('stats')
  async getStats() {
    return this.workOrdersService.getSummaryStats();
  }

  @Get('next-number')
  async getNextNumber(): Promise<{ nextNumber: string }> {
    return this.workOrdersService.getNextConduceNumber();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<WorkOrder | null> {
    return this.workOrdersService.findOne(id);
  }

  @Post()
  async create(@Body() data: Partial<WorkOrder>): Promise<WorkOrder> {
    return this.workOrdersService.create(data);
  }

  @Put(':id/approve')
  async approve(@Param('id') id: string): Promise<WorkOrder | null> {
    return this.workOrdersService.approve(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<WorkOrder>): Promise<WorkOrder | null> {
    return this.workOrdersService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.workOrdersService.remove(id);
  }
}
