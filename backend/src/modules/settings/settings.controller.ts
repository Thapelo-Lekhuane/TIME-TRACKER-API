import { Controller, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService, KEY_ESCALATED_LATE_EMAIL } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { Patch } from '@nestjs/common';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all settings (Admin only)' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Get('escalated-late-email')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get escalated late coming notification email' })
  async getEscalatedLateEmail() {
    const email = await this.settingsService.getEscalatedLateEmail();
    return { escalatedLateEmail: email };
  }

  @Patch('escalated-late-email')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Set email for receiving escalated late coming notifications (Admin only)' })
  async setEscalatedLateEmail(@Body() body: { escalatedLateEmail: string | null }) {
    await this.settingsService.setEscalatedLateEmail(body.escalatedLateEmail ?? null);
    return { success: true, escalatedLateEmail: body.escalatedLateEmail ?? null };
  }
}
