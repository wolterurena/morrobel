import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('gps_settings')
export class GpsSetting {
  @PrimaryColumn({ default: 'default' })
  id: string;

  @Column({ default: 'https://api.protrack365.com' })
  baseUrl: string;

  @Column({ default: '' })
  account: string;

  @Column({ default: '' })
  passwordRaw: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
