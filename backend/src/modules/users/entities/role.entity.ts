import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // e.g. 'admin', 'operator'

  @Column()
  displayName: string; // e.g. 'Administrador', 'Operador de Maquinaria'
}
