import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
  ) {}

  async onModuleInit() {
    // Asegurar que existan los roles por defecto en el sistema
    const defaultRoles = [
      { name: 'admin', displayName: 'Administrador' },
      { name: 'checker', displayName: 'Chequeador de Obra' },
      { name: 'operator', displayName: 'Operador de Maquinaria' }
    ];

    for (const dr of defaultRoles) {
      const exists = await this.rolesRepository.findOne({ where: { name: dr.name } });
      if (!exists) {
        this.logger.log(`Sembrando rol de sistema: ${dr.name}`);
        const role = this.rolesRepository.create(dr);
        await this.rolesRepository.save(role);
      }
    }
  }

  async findAll(): Promise<Role[]> {
    return this.rolesRepository.find();
  }

  async findOne(id: string): Promise<Role | null> {
    return this.rolesRepository.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<Role | null> {
    return this.rolesRepository.findOne({ where: { name } });
  }

  async create(data: Partial<Role>): Promise<Role> {
    const role = this.rolesRepository.create(data);
    return this.rolesRepository.save(role);
  }

  async update(id: string, data: Partial<Role>): Promise<Role | null> {
    await this.rolesRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.rolesRepository.delete(id);
  }
}
