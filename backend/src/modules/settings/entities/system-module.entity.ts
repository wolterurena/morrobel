import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('system_modules')
export class SystemModule {
  @PrimaryColumn()
  id: string; // 'dashboard', 'conduces', 'gastos', 'reportes'

  @Column()
  name: string; // Nombre visible

  @Column({ default: true })
  isEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
