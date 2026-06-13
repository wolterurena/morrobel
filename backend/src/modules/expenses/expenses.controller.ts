import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { Expense } from './entities/expense.entity';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  async findAll(): Promise<Expense[]> {
    return this.expensesService.findAll();
  }

  @Get('stats')
  async getStats() {
    return this.expensesService.getSummaryStats();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Expense | null> {
    return this.expensesService.findOne(id);
  }

  @Post()
  async create(@Body() data: Partial<Expense>): Promise<Expense> {
    return this.expensesService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: Partial<Expense>): Promise<Expense | null> {
    return this.expensesService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.expensesService.remove(id);
  }
}
