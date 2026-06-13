import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';
import { User } from '../../users/entities/user.entity';

export enum ExpenseCategory {
  FUEL = 'fuel',
  OIL_CHANGE = 'oil_change',
  MAINTENANCE = 'maintenance',
  WASHING = 'washing',
  ADVANCE_LOAN = 'advance_loan', // Préstamo o adelanto a operador (ej. "Cuco prestado")
  OTHER = 'other',
}

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  description: string; // Detalle del gasto (ej. "Combustible 7mil")

  @Column({
    type: 'enum',
    enum: ExpenseCategory,
    default: ExpenseCategory.OTHER,
  })
  category: ExpenseCategory;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number; // Monto (RD$)

  @Column({ type: 'date' })
  date: Date;

  @ManyToOne(() => Vehicle, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'vehicle_id', nullable: true })
  vehicleId: string;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operator_id' })
  operator: User; // Si el gasto es un adelanto a un operador específico

  @Column({ name: 'operator_id', nullable: true })
  operatorId: string;

  @Column({ name: 'operator_name_raw', nullable: true })
  operatorNameRaw: string; // Nombre manual del operador (ej. "Cuco")

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
