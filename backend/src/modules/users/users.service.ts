import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { PasswordResetRequest } from './entities/reset-request.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(PasswordResetRequest)
    private resetRequestsRepository: Repository<PasswordResetRequest>,
  ) {}

  async onModuleInit() {
    const isProd = process.env['NODE_ENV'] === 'production';

    // Asegurar que existan todos los usuarios de prueba
    const defaultUsers = isProd
      ? [{ username: 'admin', name: 'Administrador Morrobel', password: 'admin', roleName: 'admin' }]
      : [
          { username: 'admin', name: 'Administrador Morrobel', password: 'admin', roleName: 'admin' },
          { username: 'chequeador', name: 'Chequeador Campo', password: '123', roleName: 'checker' },
          { username: 'cuco', name: 'Cuco', password: '123', roleName: 'operator' },
          { username: 'manuel', name: 'Manuel Ortega', password: '123', roleName: 'operator' }
        ];

    for (const u of defaultUsers) {
      const exists = await this.usersRepository.findOne({ where: { username: u.username } });
      if (!exists) {
        console.log(`[Users] Sembrando usuario: ${u.username}`);
        let roleEntity = await this.rolesRepository.findOne({ where: { name: u.roleName } });
        if (!roleEntity) {
          roleEntity = this.rolesRepository.create({
            name: u.roleName,
            displayName: u.roleName === 'admin' ? 'Administrador' : u.roleName === 'checker' ? 'Chequeador' : 'Operador'
          });
          await this.rolesRepository.save(roleEntity);
        }

        const hashedPassword = await bcrypt.hash(u.password, 10);
        const user = this.usersRepository.create({
          username: u.username,
          name: u.name,
          password: hashedPassword,
          role: roleEntity
        });
        await this.usersRepository.save(user);
      }
    }
  }

  async findOneByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: {
        id: true,
        username: true,
        name: true,
        role: {
          id: true,
          name: true,
          displayName: true
        },
        createdAt: true,
      },
      relations: { role: true }
    });
  }

  async create(userData: any): Promise<User> {
    const { role, password, ...rest } = userData;
    const user = this.usersRepository.create(rest as Partial<User>) as User;
    
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }
    
    if (role) {
      const roleName = typeof role === 'string' ? role : role.name;
      const roleEntity = await this.rolesRepository.findOne({ where: { name: roleName } });
      if (roleEntity) {
        user.role = roleEntity;
      }
    }
    
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: any): Promise<User | null> {
    const { role, password, ...rest } = userData;
    const updateData: any = { ...rest };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    if (role) {
      const roleName = typeof role === 'string' ? role : role.name;
      const roleEntity = await this.rolesRepository.findOne({ where: { name: roleName } });
      if (roleEntity) {
        updateData.role = roleEntity;
      }
    }
    
    await this.usersRepository.save({ id, ...updateData });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async createResetRequest(username: string, masterCode?: string): Promise<PasswordResetRequest> {
    const user = await this.findOneByUsername(username);
    if (!user) {
      throw new Error('El usuario especificado no existe.');
    }

    if (username === 'admin') {
      const code = process.env['ADMIN_RECOVERY_CODE'] || 'MorrobelMaster2026';
      if (!masterCode || masterCode !== code) {
        throw new Error('Código maestro de recuperación incorrecto.');
      }
      
      // Reset admin password immediately to "admin"
      const hashedPassword = await bcrypt.hash('admin', 10);
      await this.usersRepository.update(user.id, { password: hashedPassword });
      
      const request = this.resetRequestsRepository.create({ username, status: 'resolved' });
      return this.resetRequestsRepository.save(request);
    }

    const existing = await this.resetRequestsRepository.findOne({
      where: { username, status: 'pending' }
    });
    if (existing) {
      return existing;
    }
    const request = this.resetRequestsRepository.create({ username });
    return this.resetRequestsRepository.save(request);
  }

  async getPendingResetRequests(): Promise<PasswordResetRequest[]> {
    return this.resetRequestsRepository.find({
      where: { status: 'pending' },
      order: { createdAt: 'DESC' }
    });
  }

  async resolveResetRequest(id: string): Promise<void> {
    const request = await this.resetRequestsRepository.findOne({ where: { id } });
    if (!request) {
      throw new Error('Solicitud no encontrada.');
    }
    
    const user = await this.findOneByUsername(request.username);
    if (user) {
      const hashedPassword = await bcrypt.hash('123456', 10);
      await this.usersRepository.update(user.id, { password: hashedPassword });
    }

    request.status = 'resolved';
    await this.resetRequestsRepository.save(request);
  }
}

