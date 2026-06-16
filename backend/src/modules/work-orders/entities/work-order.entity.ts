import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from '../../vehicles/entities/vehicle.entity';
import { User } from '../../users/entities/user.entity';

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conduce_number', unique: true })
  conduceNumber: string; // Número del conduce físico (ej. 0536)

  @Column({ type: 'date' })
  date: Date;

  @Column()
  client: string; // Nombre del cliente (ej. CAZAPOR AUTO SERVICIOS)

  @Column({ nullable: true })
  project: string; // Nombre del proyecto (ej. Corte de Piso)

  @ManyToOne(() => Vehicle, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'vehicle_id', nullable: true })
  vehicleId: string;

  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operator_id' })
  operator: User;

  @Column({ name: 'operator_id', nullable: true })
  operatorId: string;

  @Column({ name: 'operator_name_raw', nullable: true })
  operatorNameRaw: string; // Nombre manual del operador si no tiene cuenta

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  startHourmeter: number; // Horómetro Inicial

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  endHourmeter: number; // Horómetro Final

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  totalHours: number; // Horas Totales trabajadas (ej. 11.5)
  totalFuelExpense: number; // Gastos de combustible (aceite, gasoil, gasolina)

  @Column({ type: 'integer', default: 0, nullable: true })
  trips: number; // Número de viajes realizados

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, nullable: true })
  capacity: number; // Snapshot de capacidad al registrar conduce

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  oil: number; // Combustibles y Lubricantes: Aceite

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  gasoil: number; // Combustibles y Lubricantes: Gasoil

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  gasoline: number; // Combustibles y Lubricantes: Gasolina

  @Column({ nullable: true })
  others: string; // Otros insumos o observaciones

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  hourlyRate: number; // Tarifa por hora cobrada en este conduce (RD$)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number; // Monto total cobrado (totalHours * hourlyRate)

  @Column({ default: 'pending' })
  status: string; // 'pending' (pendiente de revisión), 'approved' (aprobado y calculado)

  @Column({ name: 'register_type', default: 'hourmeter' })
  registerType: string; // 'hourmeter' | 'clock'

  @Column({ name: 'shift1_start', nullable: true })
  shift1Start: string;

  @Column({ name: 'shift1_end', nullable: true })
  shift1End: string;

  @Column({ name: 'shift2_start', nullable: true })
  shift2Start: string;

  @Column({ name: 'shift2_end', nullable: true })
  shift2End: string;

  @Column({ name: 'checker_signature', type: 'text', nullable: true })
  checkerSignature: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'checker_id' })
  checker: User; // Chequeador que registró el trabajo

  @Column({ name: 'checker_id', nullable: true })
  checkerId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
