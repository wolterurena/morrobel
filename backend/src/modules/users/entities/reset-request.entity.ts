import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('password_reset_requests')
export class PasswordResetRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  username: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'resolved';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
