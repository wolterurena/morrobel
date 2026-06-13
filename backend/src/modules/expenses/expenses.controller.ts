import { Controller, Get, Post, Body, Param } from '@nestjs/common';
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
}
