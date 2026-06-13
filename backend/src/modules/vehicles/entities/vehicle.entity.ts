import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  imei: string; // IMEI de Protrack365

  @Column()
  deviceName: string; // VT05S, etc.

  @Column({ nullable: true })
  deviceType: string; // Modelo de la pala / retropala

  @Column({ nullable: true })
  plateNumber: string; // Placa

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  hourlyRate: number; // Tarifa de cobro por hora (RD$)

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  currentHourmeter: number; // Horómetro actual de la máquina

  @Column({ default: 'unknown' })
  status: string; // online, offline, working, idle

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  speed: number;

  @Column({ default: false })
  ignition: boolean; // ACC Status (ON/OFF)

  @Column({ type: 'integer', default: -1 })
  battery: number;

  @Column({ name: 'last_report', nullable: true })
  lastReport: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
