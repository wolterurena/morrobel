import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemModule } from './entities/system-module.entity';
import { GpsSetting } from './entities/gps-setting.entity';
import { SocketGateway } from '../socket/socket.gateway';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(SystemModule)
    private systemModuleRepository: Repository<SystemModule>,
    @InjectRepository(GpsSetting)
    private gpsSettingRepository: Repository<GpsSetting>,
    private socketGateway: SocketGateway,
  ) {}

  async onModuleInit() {
    // 1. Sembrar módulos
    const count = await this.systemModuleRepository.count();
    if (count === 0) {
      this.logger.log('Sembrando estado de los módulos de la aplicación...');
      const modules = [
        { id: 'dashboard', name: 'Dashboard Principal' },
        { id: 'conduces', name: 'Registro de Conduces' },
        { id: 'gastos', name: 'Registro de Gastos/Egresos' },
        { id: 'reportes', name: 'Reportes Financieros' },
        { id: 'vehiculos', name: 'Mapa de Vehículos/GPS' },
      ];
      for (const m of modules) {
        const item = this.systemModuleRepository.create(m);
        await this.systemModuleRepository.save(item);
      }
      this.logger.log('Sembrado de módulos completado.');
    } else {
      // Verificar si falta el módulo de vehículos (por actualización)
      const hasVehiculos = await this.systemModuleRepository.findOne({ where: { id: 'vehiculos' } });
      if (!hasVehiculos) {
        const item = this.systemModuleRepository.create({ id: 'vehiculos', name: 'Mapa de Vehículos/GPS' });
        await this.systemModuleRepository.save(item);
      }
    }

    // 2. Sembrar credenciales GPS por defecto
    const gpsCount = await this.gpsSettingRepository.count();
    if (gpsCount === 0) {
      this.logger.log('Sembrando configuración GPS por defecto...');
      const gpsSet = this.gpsSettingRepository.create({
        id: 'default',
        baseUrl: process.env.PROTRACK_BASE_URL || 'https://api.protrack365.com',
        account: process.env.PROTRACK_ACCOUNT || 'lureña01',
        passwordRaw: process.env.PROTRACK_PASSWORD || 'Morrobel0510',
      });
      await this.gpsSettingRepository.save(gpsSet);
    }
  }

  async findAll(): Promise<SystemModule[]> {
    return this.systemModuleRepository.find();
  }

  async update(id: string, isEnabled: boolean): Promise<SystemModule | null> {
    await this.systemModuleRepository.update(id, { isEnabled });
    const updated = await this.systemModuleRepository.findOne({ where: { id } });
    
    // Emitir cambio de estado del módulo en tiempo real a través de Sockets
    if (updated) {
      this.socketGateway.server.emit('module_status_changed', {
        id: updated.id,
        isEnabled: updated.isEnabled,
      });
    }

    return updated;
  }

  // --- CONFIGURACIÓN GPS ---
  async getGpsSettings(): Promise<GpsSetting> {
    let settings = await this.gpsSettingRepository.findOne({ where: { id: 'default' } });
    if (!settings) {
      settings = this.gpsSettingRepository.create({
        id: 'default',
        baseUrl: 'https://api.protrack365.com',
        account: '',
        passwordRaw: '',
      });
      await this.gpsSettingRepository.save(settings);
    }
    return settings;
  }

  async updateGpsSettings(data: Partial<GpsSetting>): Promise<GpsSetting> {
    await this.gpsSettingRepository.update('default', {
      baseUrl: data.baseUrl,
      account: data.account,
      passwordRaw: data.passwordRaw,
    });
    return this.getGpsSettings();
  }
}
