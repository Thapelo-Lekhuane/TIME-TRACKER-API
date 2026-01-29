import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AttendanceDailyResponseDto } from '../../common/dto/attendance-daily-response.dto';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('attendance/daily')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Daily attendance report (supports single date or date range)' })
  @ApiOkResponse({ type: AttendanceDailyResponseDto })
  async getAttendanceDaily(@Query() query: { date?: string; from?: string; to?: string; campaignId?: string }, @Req() req: any) {
    // If from and to are provided, use range endpoint
    if (query.from && query.to) {
      return this.reportsService.getAttendanceRange(query.from, query.to, query.campaignId, req.user);
    }
    // Otherwise use single date (default to today if not provided)
    const date = query.date || new Date().toISOString().split('T')[0];
    return this.reportsService.getAttendanceDaily(date, query.campaignId, req.user);
  }

  @Get('attendance/range')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Attendance report for date range' })
  @ApiOkResponse({ type: AttendanceDailyResponseDto })
  async getAttendanceRange(@Query() query: { from: string; to: string; campaignId?: string }, @Req() req: any) {
    return this.reportsService.getAttendanceRange(query.from, query.to, query.campaignId, req.user);
  }

  @Get('too-weekly')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'TOO Weekly report' })
  @ApiOkResponse({ type: Object })
  async getTooWeekly(@Query() query: { fromWeek: string; toWeek: string; campaignId?: string }, @Req() req: any) {
    return this.reportsService.getTooWeekly(query.fromWeek, query.toWeek, query.campaignId, req.user);
  }

  @Get('attendance/daily/export')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Export daily attendance as CSV' })
  async exportAttendanceDaily(@Query() query: { date: string; campaignId?: string }, @Req() req: any, @Res() res: Response) {
    const csv = await this.reportsService.exportAttendanceDaily(query.date, query.campaignId, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-daily-${query.date}.csv"`);
    res.send(csv);
  }

  @Get('attendance/range/export')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Export range attendance as CSV' })
  async exportAttendanceRange(@Query() query: { from: string; to: string; campaignId?: string }, @Req() req: any, @Res() res: Response) {
    const csv = await this.reportsService.exportAttendanceRange(query.from, query.to, query.campaignId, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-range-${query.from}-to-${query.to}.csv"`);
    res.send(csv);
  }

  @Get('too-weekly/export')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Export TOO Weekly as CSV' })
  async exportTooWeekly(@Query() query: { fromWeek: string; toWeek: string; campaignId?: string }, @Req() req: any, @Res() res: Response) {
    const csv = await this.reportsService.exportTooWeekly(query.fromWeek, query.toWeek, query.campaignId, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="too-weekly-${query.fromWeek}-to-${query.toWeek}.csv"`);
    res.send(csv);
  }
}
