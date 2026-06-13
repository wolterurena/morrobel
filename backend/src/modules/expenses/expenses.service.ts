import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseCategory } from './entities/expense.entity';
import { SocketGateway } from '../socket/socket.gateway';
import { VehiclesService } from '../vehicles/vehicles.service';

@Injectable()
export class ExpensesService implements OnModuleInit {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(Expense)
    private expenseRepository: Repository<Expense>,
    private socketGateway: SocketGateway,
    private vehiclesService: VehiclesService,
  ) {}

  async onModuleInit() {
    const count = await this.expenseRepository.count();
    if (count === 0) {
      this.logger.log('Sembrando gastos semilla basados en la nota del cliente...');
      
      const vehicles = await this.vehiclesService.findAll();
      const demoVehicle = vehicles[0] ? vehicles[0].id : null; // Asignar al primer vehículo demo

      // Datos extraídos directamente de la imagen del celular
      const seeds = [
        { description: 'Combustible', amount: 7000, category: ExpenseCategory.FUEL },
        { description: 'Combustible', amount: 5000, category: ExpenseCategory.FUEL },
        { description: 'Cuco prestado', amount: 7000, category: ExpenseCategory.ADVANCE_LOAN, operatorNameRaw: 'Cuco' },
        { description: 'Combustible', amount: 6000, category: ExpenseCategory.FUEL },
        { description: 'Cuco prestado', amount: 7000, category: ExpenseCategory.ADVANCE_LOAN, operatorNameRaw: 'Cuco' },
        { description: 'Cambio de aceite', amount: 11700, category: ExpenseCategory.OIL_CHANGE },
        { description: 'Lavada de equipo', amount: 2000, category: ExpenseCategory.WASHING },
        { description: 'Combustible', amount: 7000, category: ExpenseCategory.FUEL },
        { description: 'Combustible', amount: 7000, category: ExpenseCategory.FUEL },
        { description: 'Cuco prestado', amount: 15000, category: ExpenseCategory.ADVANCE_LOAN, operatorNameRaw: 'Cuco' },
        { description: 'Reparación mecánica', amount: 15000, category: ExpenseCategory.MAINTENANCE },
        { description: 'Cuco prestado', amount: 8000, category: ExpenseCategory.ADVANCE_LOAN, operatorNameRaw: 'Cuco' },
      ];

      let dateOffset = 0;
      for (const s of seeds) {
        // Generar fechas en los últimos días
        const date = new Date();
        date.setDate(date.getDate() - dateOffset);
        dateOffset++;

        const exp = this.expenseRepository.create({
          description: `${s.description} RD$ ${s.amount.toLocaleString()}`,
          amount: s.amount,
          category: s.category,
          operatorNameRaw: s.operatorNameRaw || null,
          date,
          vehicleId: demoVehicle,
        } as any);
        await this.expenseRepository.save(exp);
      }
      this.logger.log('Sembrado de gastos completado.');
    }
  }

  async findAll(): Promise<Expense[]> {
    return this.expenseRepository.find({
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Expense | null> {
    return this.expenseRepository.findOne({ where: { id } });
  }

  async create(data: Partial<Expense>): Promise<Expense> {
    // Intentar clasificar la categoría automáticamente en base al texto
    if (!data.category && data.description) {
      const desc = data.description.toLowerCase();
      if (desc.includes('combustible') || desc.includes('gasoil') || desc.includes('gasolina')) {
        data.category = ExpenseCategory.FUEL;
      } else if (desc.includes('aceite')) {
        data.category = ExpenseCategory.OIL_CHANGE;
      } else if (desc.includes('mecanic') || desc.includes('repar') || desc.includes('pieza')) {
        data.category = ExpenseCategory.MAINTENANCE;
      } else if (desc.includes('lavad') || desc.includes('limpia')) {
        data.category = ExpenseCategory.WASHING;
      } else if (desc.includes('prest') || desc.includes('prestado') || desc.includes('vale')) {
        data.category = ExpenseCategory.ADVANCE_LOAN;
      }
    }

    const expense = this.expenseRepository.create(data);
    const saved = await this.expenseRepository.save(expense);

    // Emitir por WebSockets
    this.socketGateway.emitNewExpense(saved);

    return saved;
  }

  async getSummaryStats(): Promise<{ totalExpenses: number; categoryBreakdown: Record<string, number> }> {
    const expenses = await this.expenseRepository.find();
    let totalExpenses = 0;
    const categoryBreakdown: Record<string, number> = {};

    for (const e of expenses) {
      const amt = Number(e.amount || 0);
      totalExpenses += amt;
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + amt;
    }

    return { totalExpenses, categoryBreakdown };
  }

  async update(id: string, data: Partial<Expense>): Promise<Expense | null> {
    await this.expenseRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.expenseRepository.delete(id);
  }
}
