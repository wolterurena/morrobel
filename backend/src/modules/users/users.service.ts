import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    const isProd = process.env['NODE_ENV'] === 'production';

    // Asegurar que existan todos los usuarios de prueba
    const defaultUsers = isProd
      ? [{ username: 'admin', name: 'Administrador Morrobel', password: 'admin', role: UserRole.ADMIN }]
      : [
          { username: 'admin', name: 'Administrador Morrobel', password: 'admin', role: UserRole.ADMIN },
          { username: 'chequeador', name: 'Chequeador Campo', password: '123', role: UserRole.CHECKER },
          { username: 'cuco', name: 'Cuco', password: '123', role: UserRole.OPERATOR },
          { username: 'manuel', name: 'Manuel Ortega', password: '123', role: UserRole.OPERATOR }
        ];

    for (const u of defaultUsers) {
      const exists = await this.usersRepository.findOne({ where: { username: u.username } });
      if (!exists) {
        console.log(`[Users] Sembrando usuario: ${u.username}`);
        const user = this.usersRepository.create(u);
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
        role: true,
        createdAt: true,
      },
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    await this.usersRepository.update(id, userData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }
}
