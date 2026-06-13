import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SystemModule } from './entities/system-module.entity';
import { GpsSetting } from './entities/gps-setting.entity';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('modules')
  async getModules(): Promise<SystemModule[]> {
    return this.settingsService.findAll();
  }

  @Put('modules/:id')
  async updateModule(
    @Param('id') id: string,
    @Body() body: { isEnabled: boolean },
  ): Promise<SystemModule | null> {
    return this.settingsService.update(id, body.isEnabled);
  }

  @Get('gps')
  async getGpsSettings(): Promise<GpsSetting> {
    return this.settingsService.getGpsSettings();
  }

  @Put('gps')
  async updateGpsSettings(@Body() body: Partial<GpsSetting>): Promise<GpsSetting> {
    return this.settingsService.updateGpsSettings(body);
  }
}
