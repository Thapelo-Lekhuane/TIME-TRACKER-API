import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { TimeEvent } from '../time-events/time-event.entity';
import { LeaveRequest } from '../leave/leave-request.entity';
import { Role } from '../../common/enums/role.enum';
import { LeaveStatus } from '../../common/enums/leave-status.enum';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(TimeEvent)
    private readonly timeEventRepo: Repository<TimeEvent>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
  ) {}

  async getAttendanceDaily(date: string, campaignId: string | undefined, user: any) {
    const campaign = await this.getCampaign(campaignId, user);
    const users = await this.userRepo.find({ 
      where: { campaign: { id: campaign.id } },
      relations: ['campaign'],
    });
    const dateStart = new Date(date + 'T00:00:00Z');
    const dateEnd = new Date(date + 'T23:59:59Z');
    
    const timeEvents = await this.timeEventRepo.find({
      where: { 
        campaign: { id: campaign.id }, 
        timestampUtc: Between(dateStart, dateEnd),
      },
      relations: ['user', 'eventType'],
    });
    
    const leaveRequests = await this.leaveRequestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.user', 'user')
      .leftJoinAndSelect('lr.leaveType', 'leaveType')
      .where('lr.campaign = :campaignId', { campaignId: campaign.id })
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('lr.startUtc <= :dateEnd', { dateEnd })
      .andWhere('lr.endUtc >= :dateStart', { dateStart })
      .getMany();

    const rows = users.map(u => {
      const status = this.getStatusForDate(u, date, timeEvents, leaveRequests);
      const { workMinutes, breakMinutes } = this.calculateMinutesForDate(u, date, timeEvents);
      const workHours = (workMinutes / 60).toFixed(2);
      
      return {
        agentName: u.fullName,
        teamLeader: u.designation || '', // Assuming designation could be team leader, adjust as needed
        campaign: campaign.name,
        [date]: {
          status,
          workHours: parseFloat(workHours),
          workMinutes,
          breakMinutes,
        },
      };
    });

    return {
      columns: ['Agent Name', 'Team Leader', 'Campaign', date],
      rows,
    };
  }

  async getAttendanceRange(from: string, to: string, campaignId: string | undefined, user: any) {
    const campaign = await this.getCampaign(campaignId, user);
    const users = await this.userRepo.find({ 
      where: { campaign: { id: campaign.id } },
      relations: ['campaign'],
    });
    const dateStart = new Date(from + 'T00:00:00Z');
    const dateEnd = new Date(to + 'T23:59:59Z');
    
    const timeEvents = await this.timeEventRepo.find({
      where: { 
        campaign: { id: campaign.id }, 
        timestampUtc: Between(dateStart, dateEnd),
      },
      relations: ['user', 'eventType'],
    });
    
    const leaveRequests = await this.leaveRequestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.user', 'user')
      .leftJoinAndSelect('lr.leaveType', 'leaveType')
      .where('lr.campaign = :campaignId', { campaignId: campaign.id })
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('lr.startUtc <= :dateEnd', { dateEnd })
      .andWhere('lr.endUtc >= :dateStart', { dateStart })
      .getMany();

    const dates = this.getDatesInRange(from, to);
    const rows = users.map(u => {
      const row: any = {
        agentName: u.fullName,
        teamLeader: u.designation || '',
        campaign: campaign.name,
      };
      
      for (const d of dates) {
        const status = this.getStatusForDate(u, d, timeEvents, leaveRequests);
        const { workMinutes, breakMinutes } = this.calculateMinutesForDate(u, d, timeEvents);
        const workHours = (workMinutes / 60).toFixed(2);
        row[d] = {
          status,
          workHours: parseFloat(workHours),
          workMinutes,
          breakMinutes,
        };
      }
      return row;
    });

    return {
      columns: ['Agent Name', 'Team Leader', 'Campaign', ...dates],
      rows,
    };
  }

  async getTooWeekly(fromWeek: string, toWeek: string, campaignId: string | undefined, user: any) {
    const campaign = await this.getCampaign(campaignId, user);
    const fromDate = new Date(fromWeek);
    const toDate = new Date(toWeek);
    
    // Get all attendance data for the range
    const rangeData = await this.getAttendanceRange(fromWeek, toWeek, campaignId, user);
    
    // Group dates by week (week ending on Sunday)
    const weeks: Record<string, string[]> = {};
    const weekEndDates: string[] = [];
    
    let currentWeekStart = new Date(fromDate);
    // Find the Sunday of the week containing fromDate
    const dayOfWeek = currentWeekStart.getUTCDay();
    currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() - dayOfWeek);
    
    while (currentWeekStart <= toDate) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      
      if (weekEnd <= toDate) {
        weekEndDates.push(weekEndStr);
        weeks[weekEndStr] = [];
        
        // Collect dates in this week
        for (let d = new Date(currentWeekStart); d <= weekEnd; d.setUTCDate(d.getUTCDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          if (dateStr >= fromWeek && dateStr <= toWeek) {
            weeks[weekEndStr].push(dateStr);
          }
        }
      }
      
      currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + 7);
    }
    
    // Calculate metrics per week
    const rows: any[] = [];
    const rowLabels = ['Shifts', 'Present', 'Sick Leave', 'Absence', 'Family Responsibility Leave', 'Annual Leave', 'S&A', 'FRL %', 'AL %', 'TOO %'];
    
    for (const weekEnd of weekEndDates) {
      const weekDates = weeks[weekEnd];
      let shifts = 0;
      let present = 0;
      let sickLeave = 0;
      let absence = 0;
      let frl = 0;
      let annualLeave = 0;
      let totalWorkHours = 0;
      
      for (const row of rangeData.rows) {
        for (const date of weekDates) {
          if (row[date]) {
            const status = row[date].status;
            if (status === 'Present') {
              present++;
              shifts++;
              totalWorkHours += row[date].workHours || 0;
            } else if (status === 'Sick Leave') {
              sickLeave++;
            } else if (status === 'Absent' || status === 'AWOL') {
              absence++;
            } else if (status === 'Family Responsibility Leave') {
              frl++;
            } else if (status === 'Annual Leave' || status === 'Annual Leave Halfday') {
              annualLeave++;
            }
          }
        }
      }
      
      const totalDays = weekDates.length * rangeData.rows.length;
      const frlPercent = totalDays > 0 ? ((frl / totalDays) * 100).toFixed(2) : '0.00';
      const alPercent = totalDays > 0 ? ((annualLeave / totalDays) * 100).toFixed(2) : '0.00';
      const tooPercent = totalDays > 0 ? (((present + sickLeave + annualLeave) / totalDays) * 100).toFixed(2) : '0.00';
      
      rows.push({
        weekEnd,
        shifts,
        present,
        sickLeave,
        absence,
        frl,
        annualLeave,
        sa: sickLeave + absence,
        frlPercent: parseFloat(frlPercent),
        alPercent: parseFloat(alPercent),
        tooPercent: parseFloat(tooPercent),
        totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
      });
    }
    
    return {
      campaign: campaign.name,
      columns: ['Metric', ...weekEndDates],
      rows: rowLabels.map((label, idx) => {
        const row: any = { metric: label };
        for (const weekEnd of weekEndDates) {
          const weekData = rows.find(r => r.weekEnd === weekEnd);
          if (label === 'Shifts') row[weekEnd] = weekData?.shifts || 0;
          else if (label === 'Present') row[weekEnd] = weekData?.present || 0;
          else if (label === 'Sick Leave') row[weekEnd] = weekData?.sickLeave || 0;
          else if (label === 'Absence') row[weekEnd] = weekData?.absence || 0;
          else if (label === 'Family Responsibility Leave') row[weekEnd] = weekData?.frl || 0;
          else if (label === 'Annual Leave') row[weekEnd] = weekData?.annualLeave || 0;
          else if (label === 'S&A') row[weekEnd] = weekData?.sa || 0;
          else if (label === 'FRL %') row[weekEnd] = weekData?.frlPercent || 0;
          else if (label === 'AL %') row[weekEnd] = weekData?.alPercent || 0;
          else if (label === 'TOO %') row[weekEnd] = weekData?.tooPercent || 0;
        }
        return row;
      }),
    };
  }

  async exportAttendanceDaily(date: string, campaignId: string | undefined, user: any): Promise<string> {
    const data = await this.getAttendanceDaily(date, campaignId, user);
    // Convert to CSV matching Excel format
    let csv = data.columns.join(',') + ',Hours Worked\n';
    for (const row of data.rows) {
      const dateData = row[date] as { status: string; workHours: number; workMinutes: number; breakMinutes: number };
      csv += `"${row.agentName}","${row.teamLeader}","${row.campaign}","${dateData.status}","${dateData.workHours}"\n`;
    }
    return csv;
  }

  async exportAttendanceRange(from: string, to: string, campaignId: string | undefined, user: any): Promise<string> {
    const data = await this.getAttendanceRange(from, to, campaignId, user);
    // CSV matching Excel format with date columns
    const dateColumns = data.columns.slice(3); // Skip Agent Name, Team Leader, Campaign
    let csv = data.columns.join(',');
    // Add Hours Worked column for each date
    const headerDates = dateColumns.map(d => `Hours (${d})`).join(',');
    csv += ',' + headerDates + '\n';
    
    for (const row of data.rows) {
      const values = [
        `"${row.agentName}"`,
        `"${row.teamLeader}"`,
        `"${row.campaign}"`,
      ];
      
      for (const date of dateColumns) {
        const dateData = row[date] as { status: string; workHours: number; workMinutes: number; breakMinutes: number };
        values.push(`"${dateData.status}"`);
      }
      
      // Add hours worked for each date
      for (const date of dateColumns) {
        const dateData = row[date] as { status: string; workHours: number; workMinutes: number; breakMinutes: number };
        values.push(`"${dateData.workHours}"`);
      }
      
      csv += values.join(',') + '\n';
    }
    return csv;
  }

  async exportTooWeekly(fromWeek: string, toWeek: string, campaignId: string | undefined, user: any): Promise<string> {
    const data = await this.getTooWeekly(fromWeek, toWeek, campaignId, user);
    // CSV matching Excel TOO Weekly format
    let csv = data.columns.join(',') + '\n';
    
    for (const row of data.rows) {
      const values = [`"${row.metric}"`];
      const weekEnds = data.columns.slice(1); // Skip 'Metric' column
      
      for (const weekEnd of weekEnds) {
        values.push(`"${row[weekEnd] || 0}"`);
      }
      
      csv += values.join(',') + '\n';
    }
    
    return csv;
  }

  private async getCampaign(campaignId: string | undefined, user: any): Promise<Campaign> {
    if (campaignId) {
      const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
      if (!campaign) throw new Error('Campaign not found');
      return campaign;
    }
    if (user.role === Role.MANAGER) {
      const userEntity = await this.userRepo.findOne({ where: { id: user.userId }, relations: ['campaign'] });
      if (!userEntity?.campaign) throw new Error('No campaign for manager');
      return userEntity.campaign;
    }
    throw new Error('Campaign required for admin');
  }

  private getStatusForDate(user: User, date: string, timeEvents: TimeEvent[], leaveRequests: LeaveRequest[]): string {
    const leave = leaveRequests.find(lr => lr.user.id === user.id && lr.startUtc <= new Date(date + 'T23:59:59Z') && lr.endUtc >= new Date(date + 'T00:00:00Z'));
    if (leave) return leave.leaveType.name;
    const events = timeEvents.filter(te => te.user.id === user.id);
    if (events.length > 0) return 'Present';
    return 'Absent';
  }

  private calculateMinutesForDate(user: User, date: string, timeEvents: TimeEvent[]): { workMinutes: number; breakMinutes: number } {
    const events = timeEvents.filter(te => te.user.id === user.id && te.timestampUtc.toISOString().startsWith(date));
    // Simple calculation: assume start work, end work, breaks
    // This is placeholder; need proper pairing
    let workStart: Date | null = null;
    let breakStart: Date | null = null;
    let workMinutes = 0;
    let breakMinutes = 0;
    for (const event of events.sort((a, b) => a.timestampUtc.getTime() - b.timestampUtc.getTime())) {
      if (event.eventType.name === 'Start Work') {
        workStart = event.timestampUtc;
      } else if (event.eventType.name === 'End Work' && workStart) {
        workMinutes += (event.timestampUtc.getTime() - workStart.getTime()) / 60000;
        workStart = null;
      } else if (event.eventType.isBreak && !breakStart) {
        breakStart = event.timestampUtc;
      } else if (event.eventType.isBreak && breakStart) {
        breakMinutes += (event.timestampUtc.getTime() - breakStart.getTime()) / 60000;
        breakStart = null;
      }
    }
    return { workMinutes: Math.round(workMinutes), breakMinutes: Math.round(breakMinutes) };
  }

  private getDatesInRange(from: string, to: string): string[] {
    const dates: string[] = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }
}
