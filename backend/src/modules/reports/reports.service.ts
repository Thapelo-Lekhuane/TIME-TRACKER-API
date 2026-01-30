import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
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
    // Validate date format
    if (!date || isNaN(Date.parse(date))) {
      throw new Error(`Invalid date format: ${date}`);
    }
    
    // Validate and create date objects
    const dateStart = new Date(date + 'T00:00:00Z');
    const dateEnd = new Date(date + 'T23:59:59Z');
    
    if (isNaN(dateStart.getTime()) || isNaN(dateEnd.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }

    // Handle "All Campaigns" - when campaignId is empty/undefined
    let campaigns: Campaign[] = [];
    if (!campaignId) {
      // For ADMIN and MANAGER, get all campaigns
      campaigns = await this.campaignRepo.find();
    } else {
      const campaign = await this.getCampaign(campaignId, user);
      if (campaign) {
        campaigns = [campaign];
      }
    }
    
    if (campaigns.length === 0) {
      return {
        columns: ['Agent Name', 'Team Leader', 'Campaign', date],
        rows: [],
      };
    }
    
    // Get all users from all selected campaigns
    const campaignIds = campaigns.map(c => c.id);
    const users = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.campaign', 'campaign')
      .leftJoinAndSelect('user.teamLeader', 'teamLeader')
      .where('user.campaignId IN (:...campaignIds)', { campaignIds })
      .getMany();
    
    // Get time events for all campaigns
    const timeEvents = await this.timeEventRepo
      .createQueryBuilder('te')
      .leftJoinAndSelect('te.user', 'user')
      .leftJoinAndSelect('te.eventType', 'eventType')
      .leftJoinAndSelect('te.campaign', 'campaign')
      .where('te.campaignId IN (:...campaignIds)', { campaignIds })
      .andWhere('te.timestampUtc BETWEEN :dateStart AND :dateEnd', { dateStart, dateEnd })
      .getMany();
    
    // Get leave requests for all campaigns
    const leaveRequests = await this.leaveRequestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.user', 'user')
      .leftJoinAndSelect('lr.leaveType', 'leaveType')
      .leftJoinAndSelect('lr.campaign', 'campaign')
      .where('lr.campaignId IN (:...campaignIds)', { campaignIds })
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('lr.startUtc <= :dateEnd', { dateEnd })
      .andWhere('lr.endUtc >= :dateStart', { dateStart })
      .getMany();

    const rows = users.map(u => {
      // Filter time events for this user
      const userTimeEvents = timeEvents.filter(te => te.user.id === u.id);
      // Filter leave requests for this user
      const userLeaveRequests = leaveRequests.filter(lr => lr.user.id === u.id);
      
      const status = this.getStatusForDate(u, date, userTimeEvents, userLeaveRequests);
      const { workMinutes, breakMinutes } = this.calculateMinutesForDate(u, date, userTimeEvents);
      const workHours = (workMinutes / 60).toFixed(2);
      
      return {
        agentName: u.fullName,
        teamLeader: u.teamLeader?.fullName || '',
        campaign: u.campaign?.name || '',
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

  async getWeeklyTeamAttendance(weekStart: string, campaignId: string | undefined, user: any) {
    // Calculate week end date (7 days from start)
    const startDate = new Date(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // Week is 7 days (0-6)
    
    const weekEnd = endDate.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0]; // Current date for comparison
    
    // Use existing getAttendanceRange method
    const rangeData = await this.getAttendanceRange(weekStart, weekEnd, campaignId, user);
    
    // Calculate total hours for each user, excluding future days
    const rowsWithTotals = rangeData.rows.map((row: any) => {
      let totalWorkMinutes = 0;
      let totalWorkHours = 0;
      
      // Sum up work minutes from all days in the week (only past and current days)
      for (const date of rangeData.columns.slice(3)) { // Skip Agent Name, Team Leader, Campaign columns
        // Only count hours for dates that have passed (not future dates)
        if (date <= today && row[date] && row[date].workMinutes) {
          totalWorkMinutes += row[date].workMinutes || 0;
        }
      }
      
      totalWorkHours = parseFloat((totalWorkMinutes / 60).toFixed(2));
      
      // Create new row with blanks for future days
      const newRow: any = {
        agentName: row.agentName,
        teamLeader: row.teamLeader,
        campaign: row.campaign,
      };
      
      // Copy date data, but leave future dates blank
      for (const date of rangeData.columns.slice(3)) {
        if (date > today) {
          // Future date - leave blank
          newRow[date] = null;
        } else {
          // Past or current date - include data
          newRow[date] = row[date];
        }
      }
      
      return {
        ...newRow,
        totalWorkHours,
        totalWorkMinutes,
      };
    });
    
    return {
      ...rangeData,
      rows: rowsWithTotals,
      weekStart,
      weekEnd,
      today, // Include today for frontend reference
    };
  }

  async getAttendanceRange(from: string, to: string, campaignId: string | undefined, user: any) {
    // Validate date formats first
    if (!from || !to) {
      throw new Error('Both from and to dates are required');
    }
    
    // Validate dates are valid
    const fromDateTest = new Date(from);
    const toDateTest = new Date(to);
    if (isNaN(fromDateTest.getTime()) || isNaN(toDateTest.getTime())) {
      throw new Error(`Invalid date format: from=${from}, to=${to}`);
    }
    
    // Create validated date objects
    const dateStart = new Date(from + 'T00:00:00Z');
    const dateEnd = new Date(to + 'T23:59:59Z');
    
    // Double-check dates are valid
    if (isNaN(dateStart.getTime()) || isNaN(dateEnd.getTime())) {
      throw new Error(`Invalid date range: from=${from}, to=${to}`);
    }

    const dates = this.getDatesInRange(from, to);

    // Handle "All Campaigns" - when campaignId is empty/undefined
    let campaigns: Campaign[] = [];
    if (!campaignId) {
      // For ADMIN and MANAGER, get all campaigns
      campaigns = await this.campaignRepo.find();
    } else {
      const campaign = await this.getCampaign(campaignId, user);
      if (campaign) {
        campaigns = [campaign];
      }
    }
    
    if (campaigns.length === 0) {
      return {
        columns: ['Agent Name', 'Team Leader', 'Campaign', ...dates],
        rows: [],
      };
    }
    
    // Get all users from all selected campaigns
    const campaignIds = campaigns.map(c => c.id);
    const users = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.campaign', 'campaign')
      .leftJoinAndSelect('user.teamLeader', 'teamLeader')
      .where('user.campaignId IN (:...campaignIds)', { campaignIds })
      .getMany();
    
    // Get time events for all campaigns
    const timeEvents = await this.timeEventRepo
      .createQueryBuilder('te')
      .leftJoinAndSelect('te.user', 'user')
      .leftJoinAndSelect('te.eventType', 'eventType')
      .leftJoinAndSelect('te.campaign', 'campaign')
      .where('te.campaignId IN (:...campaignIds)', { campaignIds })
      .andWhere('te.timestampUtc BETWEEN :dateStart AND :dateEnd', { dateStart, dateEnd })
      .getMany();
    
    // Get leave requests for all campaigns
    const leaveRequests = await this.leaveRequestRepo
      .createQueryBuilder('lr')
      .leftJoinAndSelect('lr.user', 'user')
      .leftJoinAndSelect('lr.leaveType', 'leaveType')
      .leftJoinAndSelect('lr.campaign', 'campaign')
      .where('lr.campaignId IN (:...campaignIds)', { campaignIds })
      .andWhere('lr.status = :status', { status: LeaveStatus.APPROVED })
      .andWhere('lr.startUtc <= :dateEnd', { dateEnd })
      .andWhere('lr.endUtc >= :dateStart', { dateStart })
      .getMany();

    const rows = users.map(u => {
      const row: any = {
        agentName: u.fullName,
        teamLeader: u.teamLeader?.fullName || '',
        campaign: u.campaign?.name || '',
      };
      
      for (const d of dates) {
        // Filter time events and leave requests for this user
        const userTimeEvents = timeEvents.filter(te => te.user.id === u.id);
        const userLeaveRequests = leaveRequests.filter(lr => lr.user.id === u.id);
        
        const status = this.getStatusForDate(u, d, userTimeEvents, userLeaveRequests);
        const { workMinutes, breakMinutes } = this.calculateMinutesForDate(u, d, userTimeEvents);
        const workHours = (workMinutes / 60).toFixed(2);
        
        // Get late minutes for this date (from work start event)
        const workStartEvent = userTimeEvents.find(te => 
          te.eventType.name.includes('Work Start') && 
          te.timestampUtc.toISOString().startsWith(d)
        );
        const lateMinutes = workStartEvent?.lateMinutes || null;
        
        row[d] = {
          status,
          workHours: parseFloat(workHours),
          workMinutes,
          breakMinutes,
          lateMinutes,
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
    
    // If no campaign found, return empty result
    if (!campaign) {
      return {
        campaign: 'No Campaign',
        columns: ['Metric'],
        rows: [],
      };
    }
    
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
    // Sort rows by campaign to group them
    const sortedRows = [...data.rows].sort((a, b) => {
      const campaignA = a.campaign || 'ZZZ';
      const campaignB = b.campaign || 'ZZZ';
      return campaignA.localeCompare(campaignB);
    });
    
    // Convert to CSV matching Excel format
    let csv = data.columns.join(',') + ',Hours Worked\n';
    let currentCampaign = '';
    let totalHours = 0;
    
    for (const row of sortedRows) {
      const dateData = row[date] as { status: string; workHours: number; workMinutes: number; breakMinutes: number };
      const hours = dateData?.workHours || 0;
      totalHours += hours;
      
      // Add separator line when campaign changes
      if (currentCampaign && currentCampaign !== row.campaign) {
        csv += '\n'; // Empty line separator
      }
      currentCampaign = row.campaign || '';
      
      csv += `"${row.agentName}","${row.teamLeader}","${row.campaign}","${dateData?.status || 'Absent'}","${hours}"\n`;
    }
    
    // Add total row
    csv += `\n"TOTAL HOURS","","","","${totalHours.toFixed(2)}"\n`;
    
    return csv;
  }

  async exportAttendanceRange(from: string, to: string, campaignId: string | undefined, user: any): Promise<string> {
    const data = await this.getAttendanceRange(from, to, campaignId, user);
    // Sort rows by campaign to group them
    const sortedRows = [...data.rows].sort((a, b) => {
      const campaignA = a.campaign || 'ZZZ';
      const campaignB = b.campaign || 'ZZZ';
      return campaignA.localeCompare(campaignB);
    });
    
    // CSV matching Excel format with date columns
    const dateColumns = data.columns.slice(3); // Skip Agent Name, Team Leader, Campaign
    let csv = data.columns.join(',');
    // Add Hours Worked column for each date
    const headerDates = dateColumns.map(d => `Hours (${d})`).join(',');
    csv += ',' + headerDates + ',Total Hours\n';
    
    let currentCampaign = '';
    let grandTotalHours = 0;
    const dateTotals: { [key: string]: number } = {};
    dateColumns.forEach(d => dateTotals[d] = 0);
    
    for (const row of sortedRows) {
      // Add separator line when campaign changes
      if (currentCampaign && currentCampaign !== row.campaign) {
        csv += '\n'; // Empty line separator
      }
      currentCampaign = row.campaign || '';
      
      const values = [
        `"${row.agentName}"`,
        `"${row.teamLeader}"`,
        `"${row.campaign}"`,
      ];
      
      let rowTotalHours = 0;
      for (const date of dateColumns) {
        const dateData = row[date] as { status: string; workHours: number; workMinutes: number; breakMinutes: number };
        values.push(`"${dateData?.status || 'Absent'}"`);
      }
      
      // Add hours worked for each date
      for (const date of dateColumns) {
        const dateData = row[date] as { status: string; workHours: number; workMinutes: number; breakMinutes: number };
        const hours = dateData?.workHours || 0;
        values.push(`"${hours.toFixed(2)}"`);
        rowTotalHours += hours;
        dateTotals[date] = (dateTotals[date] || 0) + hours;
      }
      
      values.push(`"${rowTotalHours.toFixed(2)}"`);
      grandTotalHours += rowTotalHours;
      
      csv += values.join(',') + '\n';
    }
    
    // Add totals row
    const totalValues = ['"TOTAL HOURS"', '""', '""'];
    dateColumns.forEach(() => totalValues.push('""')); // Status columns
    dateColumns.forEach(d => totalValues.push(`"${dateTotals[d].toFixed(2)}"`));
    totalValues.push(`"${grandTotalHours.toFixed(2)}"`);
    csv += '\n' + totalValues.join(',') + '\n';
    
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

  private async getCampaign(campaignId: string | undefined, user: any): Promise<Campaign | null> {
    if (campaignId) {
      const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
      if (!campaign) return null;
      return campaign;
    }
    
    // For MANAGER, get their assigned campaign
    if (user.role === Role.MANAGER) {
      const userEntity = await this.userRepo.findOne({ where: { id: user.userId }, relations: ['campaign'] });
      if (userEntity?.campaign) {
        return userEntity.campaign;
      }
    }
    
    // For ADMIN or if manager has no campaign, get the first available campaign
    const firstCampaign = await this.campaignRepo.findOne({ where: {} });
    return firstCampaign || null;
  }

  private getStatusForDate(user: User, date: string, timeEvents: TimeEvent[], leaveRequests: LeaveRequest[]): string {
    // Check for approved leave first
    const leave = leaveRequests.find(lr => 
      lr.user.id === user.id && 
      lr.status === 'APPROVED' &&
      lr.startUtc <= new Date(date + 'T23:59:59Z') && 
      lr.endUtc >= new Date(date + 'T00:00:00Z')
    );
    if (leave) return leave.leaveType.name;
    
    // Check for "Work Start" event - user must have clocked in to be marked as Present
    const userEvents = timeEvents.filter(te => te.user.id === user.id);
    const hasWorkStart = userEvents.some(te => 
      te.eventType.name.includes('Work Start') && 
      te.timestampUtc.toISOString().startsWith(date)
    );
    
    if (hasWorkStart) return 'Present';
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
      if (event.eventType?.name?.includes?.('Work Start')) {
        workStart = event.timestampUtc;
      } else if (event.eventType?.name?.includes?.('Work End') && workStart) {
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
