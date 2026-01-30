import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LeaveType } from './leave-type.entity';
import { LeaveRequest } from './leave-request.entity';
import { LeaveBalance } from './leave-balance.entity';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { LeaveStatus } from '../../common/enums/leave-status.enum';
import { Role } from '../../common/enums/role.enum';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance)
    private readonly leaveBalanceRepo: Repository<LeaveBalance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    private readonly emailService: EmailService,
  ) {}

  // Seed all default leave types from the Excel specification
  async seedDefaultLeaveTypes() {
    const defaultLeaveTypes = [
      { name: 'Present', paid: true, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 1 },
      { name: 'Annual Leave', paid: true, fullDayAllowed: true, halfDayAllowed: true, sortOrder: 2 },
      { name: 'Sick Leave', paid: true, fullDayAllowed: true, halfDayAllowed: true, sortOrder: 3 },
      { name: 'Birthday leave', paid: true, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 4 },
      { name: 'Family Responsibility Leave', paid: true, fullDayAllowed: true, halfDayAllowed: true, sortOrder: 5 },
      { name: 'Absent', paid: false, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 6 },
      { name: 'Terminated / Leaver', paid: false, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 7 },
      { name: 'Lieu Day', paid: true, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 8 },
      { name: 'Day Off', paid: false, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 9 },
      { name: 'Annual Leave Halfday', paid: true, fullDayAllowed: false, halfDayAllowed: true, sortOrder: 10 },
      { name: 'Sick Leave Halfday', paid: true, fullDayAllowed: false, halfDayAllowed: true, sortOrder: 11 },
      { name: 'Family Responsibility Leave Halfday', paid: true, fullDayAllowed: false, halfDayAllowed: true, sortOrder: 12 },
      { name: 'Maternity Leave', paid: true, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 13 },
      { name: 'Paternity Leave', paid: true, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 14 },
      { name: 'AWOL', paid: false, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 15 },
      { name: 'Unpaid Half Day', paid: false, fullDayAllowed: false, halfDayAllowed: true, sortOrder: 16 },
      { name: 'Training', paid: true, fullDayAllowed: true, halfDayAllowed: true, sortOrder: 17 },
      { name: 'Unpaid Leave', paid: false, fullDayAllowed: true, halfDayAllowed: true, sortOrder: 18 },
      { name: 'Redeployment', paid: true, fullDayAllowed: true, halfDayAllowed: false, sortOrder: 19 },
    ];

    for (const leaveTypeData of defaultLeaveTypes) {
      const existing = await this.leaveTypeRepo.findOne({ where: { name: leaveTypeData.name } });
      if (!existing) {
        const leaveType = this.leaveTypeRepo.create({
          ...leaveTypeData,
          active: true,
        });
        await this.leaveTypeRepo.save(leaveType);
        this.logger.log(`Created leave type: ${leaveTypeData.name}`);
      } else {
        // Update sortOrder if it exists but sortOrder is different
        if (existing.sortOrder !== leaveTypeData.sortOrder) {
          existing.sortOrder = leaveTypeData.sortOrder;
          await this.leaveTypeRepo.save(existing);
        }
      }
    }
  }

  async findAllLeaveTypes() {
    // Ordered list as per spec
    const order = [
      'Present',
      'Annual Leave',
      'Sick Leave',
      'Birthday leave',
      'Family Responsibility Leave',
      'Absent',
      'Terminated / Leaver',
      'Lieu Day',
      'Day Off',
      'Annual Leave Halfday',
      'Sick Leave Halfday',
      'Family Responsibility Leave Halfday',
      'Maternity Leave',
      'Paternity Leave',
      'AWOL',
      'Unpaid Half Day',
      'Training',
      'Unpaid Leave',
      'Redeployment',
    ];
    const types = await this.leaveTypeRepo.find();
    // Backfill persisted sortOrder (non-destructive).
    const updates: LeaveType[] = [];
    for (const t of types) {
      if (t.sortOrder === undefined || t.sortOrder === null) {
        const idx = order.indexOf(t.name);
        t.sortOrder = idx === -1 ? 9999 : idx + 1;
        updates.push(t);
      }
    }
    if (updates.length) {
      await this.leaveTypeRepo.save(updates);
    }

    return types.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
      return a.name.localeCompare(b.name);
    });
  }

  async createLeaveType(dto: {
    name: string;
    paid?: boolean;
    fullDayAllowed?: boolean;
    halfDayAllowed?: boolean;
    sortOrder?: number;
  }) {
    const existing = await this.leaveTypeRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      // If already exists, just return it (avoid unique constraint explosions in admin UI).
      return existing;
    }
    const leaveType = this.leaveTypeRepo.create({
      name: dto.name,
      paid: dto.paid ?? true,
      fullDayAllowed: dto.fullDayAllowed ?? true,
      halfDayAllowed: dto.halfDayAllowed ?? true,
      sortOrder: dto.sortOrder ?? 9999,
      active: true,
    });
    return this.leaveTypeRepo.save(leaveType);
  }

  async updateLeaveType(id: string, dto: any) {
    const leaveType = await this.leaveTypeRepo.findOne({ where: { id } });
    if (!leaveType) throw new NotFoundException('Leave type not found');
    Object.assign(leaveType, dto);
    return this.leaveTypeRepo.save(leaveType);
  }

  async createLeaveRequest(dto: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason?: string;
  }, userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['campaign'],
    });
    if (!user || !user.campaign) {
      throw new BadRequestException('You are not assigned to a campaign yet. Please wait until you are assigned to a campaign before applying for leave.');
    }

    // Get the full campaign with leaveApproverEmail
    const campaign = await this.campaignRepo.findOne({
      where: { id: user.campaign.id },
    });
    
    if (!campaign) {
      throw new BadRequestException('Campaign not found. Please contact your administrator.');
    }

    // Store campaign properties to ensure TypeScript knows they're not null
    const campaignId = campaign.id;
    const campaignName = campaign.name;
    const leaveApproverEmail = campaign.leaveApproverEmail;

    const leaveType = await this.leaveTypeRepo.findOne({
      where: { id: dto.leaveTypeId },
    });
    if (!leaveType) {
      throw new BadRequestException('Invalid leave type');
    }

    const startUtc = new Date(dto.startDate + 'T00:00:00Z');
    const endUtc = new Date(dto.endDate + 'T23:59:59Z');

    // Calculate number of days
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const numberOfDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;

    const leaveRequest = this.leaveRequestRepo.create({
      user,
      campaign: user.campaign,
      leaveType,
      startUtc,
      endUtc,
      status: LeaveStatus.PENDING,
      reason: dto.reason,
    });
    const savedRequest = await this.leaveRequestRepo.save(leaveRequest);

    // Update pending days in leave balance
    const year = startUtc.getFullYear();
    await this.updatePendingDays(userId, dto.leaveTypeId, year, numberOfDays);

    // Get base URL from config (default to localhost:3000 if not set)
    const baseUrl = process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';

    // Notify campaign creator/manager (leave approver) and admins
    // Campaign leave approver is set by the manager when creating/editing the campaign
    const campaignManagers = await this.userRepo.find({
      where: {
        role: Role.MANAGER,
        campaign: { id: campaignId },
      },
    });
    const admins = await this.userRepo.find({
      where: { role: Role.ADMIN },
    });
    const managers = [...campaignManagers, ...admins];

    const emailPromises: Promise<boolean>[] = [];

    // Always send to campaign leave approver first (campaign creator/manager)
    if (leaveApproverEmail) {
      emailPromises.push(
        this.emailService.sendLeaveRequestNotification({
          toEmail: leaveApproverEmail,
          campaignName: campaignName,
          employeeName: user.fullName,
          employeeEmail: user.email,
          leaveType: leaveType.name,
          startDate: dto.startDate,
          endDate: dto.endDate,
          numberOfDays,
          reason: dto.reason,
          leaveRequestId: savedRequest.id,
          baseUrl,
        }).catch(err => {
          this.logger.error(`Failed to send leave request email to ${leaveApproverEmail}`, err);
          return false;
        })
      );
    } else {
      this.logger.warn(`Campaign "${campaignName}" has no leave approver email; set it in campaign settings so the manager receives leave requests.`);
    }

    // Also send to managers (in campaign) and admins, avoiding duplicates
    const notifiedEmails = new Set<string>();
    if (leaveApproverEmail) {
      notifiedEmails.add(leaveApproverEmail.toLowerCase());
    }

    for (const manager of managers) {
      const email = manager.email.toLowerCase();
      if (!notifiedEmails.has(email)) {
        notifiedEmails.add(email);
        emailPromises.push(
          this.emailService.sendLeaveRequestNotification({
            toEmail: manager.email,
            campaignName: campaignName,
            employeeName: user.fullName,
            employeeEmail: user.email,
            leaveType: leaveType.name,
            startDate: dto.startDate,
            endDate: dto.endDate,
            numberOfDays,
            reason: dto.reason,
            leaveRequestId: savedRequest.id,
            baseUrl,
          }).catch(err => {
            this.logger.error(`Failed to send leave request email to ${manager.email}`, err);
            return false;
          })
        );
      }
    }

    // Wait for all notification emails to be sent (but don't fail if they fail)
    await Promise.all(emailPromises);

    // Send confirmation email to the applicant
    await this.emailService.sendLeaveRequestConfirmation({
      toEmail: user.email,
      employeeName: user.fullName,
      leaveType: leaveType.name,
      startDate: dto.startDate,
      endDate: dto.endDate,
      numberOfDays,
      campaignName: campaignName,
    }).catch(err => {
      this.logger.error(`Failed to send leave request confirmation email to ${user.email}`, err);
    });

    return savedRequest;
  }

  /** Map leave request to plain object to avoid circular JSON */
  private toLeaveRequestResponse(lr: LeaveRequest) {
    return {
      id: lr.id,
      user: lr.user ? { id: lr.user.id, fullName: lr.user.fullName } : undefined,
      campaign: lr.campaign ? { id: lr.campaign.id, name: lr.campaign.name } : undefined,
      leaveType: lr.leaveType ? { id: lr.leaveType.id, name: lr.leaveType.name } : undefined,
      startUtc: lr.startUtc,
      endUtc: lr.endUtc,
      status: lr.status,
      approvedBy: lr.approvedBy ? { id: lr.approvedBy.id, fullName: lr.approvedBy.fullName } : undefined,
      approvedAt: lr.approvedAt,
      reason: lr.reason,
    };
  }

  // Get leave requests for a specific user (their own requests)
  async findMyLeaveRequests(userId: string) {
    const list = await this.leaveRequestRepo.find({
      where: { user: { id: userId } },
      relations: ['user', 'leaveType', 'campaign', 'approvedBy'],
      order: { startUtc: 'DESC' },
    });
    return list.map((lr) => this.toLeaveRequestResponse(lr));
  }

  async findLeaveRequests(query: { campaignId?: string; userId?: string; status?: LeaveStatus; from?: string; to?: string }, user: any) {
    let campaignIdFilter: string | null = query.campaignId || null;

    if (user.role === Role.MANAGER) {
      const userEntity = await this.userRepo.findOne({
        where: { id: user.userId },
        relations: ['campaign'],
      });
      if (userEntity?.campaign) {
        campaignIdFilter = userEntity.campaign.id;
      } else {
        return [];
      }
    }

    const queryBuilder = this.leaveRequestRepo
      .createQueryBuilder('leaveRequest')
      .leftJoinAndSelect('leaveRequest.user', 'user')
      .leftJoinAndSelect('leaveRequest.campaign', 'campaign')
      .leftJoinAndSelect('leaveRequest.leaveType', 'leaveType');

    if (campaignIdFilter) {
      queryBuilder.andWhere('leaveRequest.campaignId = :campaignId', { campaignId: campaignIdFilter });
    }
    if (query.userId) {
      queryBuilder.andWhere('leaveRequest.userId = :userId', { userId: query.userId });
    }
    if (query.status) {
      queryBuilder.andWhere('leaveRequest.status = :status', { status: query.status });
    }

    if (query.from || query.to) {
      if (query.from && query.to) {
        const fromDate = new Date(query.from + 'T00:00:00Z');
        const toDate = new Date(query.to + 'T23:59:59Z');
        queryBuilder.andWhere('(leaveRequest.startUtc <= :toDate AND leaveRequest.endUtc >= :fromDate)', {
          fromDate,
          toDate,
        });
      } else if (query.from) {
        const fromDate = new Date(query.from + 'T00:00:00Z');
        queryBuilder.andWhere('leaveRequest.endUtc >= :fromDate', { fromDate });
      } else if (query.to) {
        const toDate = new Date(query.to + 'T23:59:59Z');
        queryBuilder.andWhere('leaveRequest.startUtc <= :toDate', { toDate });
      }
    }

    const list = await queryBuilder.orderBy('leaveRequest.startUtc', 'DESC').getMany();
    return list.map((lr) => this.toLeaveRequestResponse(lr));
  }

  async updateLeaveRequestStatus(id: string, body: { status: LeaveStatus; reason?: string }, approverId: string) {
    const leaveRequest = await this.leaveRequestRepo.findOne({
      where: { id },
      relations: ['user', 'campaign', 'leaveType', 'approvedBy'],
    });
    if (!leaveRequest) throw new NotFoundException('Leave request not found');

    const approver = await this.userRepo.findOne({ where: { id: approverId } });
    if (!approver) throw new NotFoundException('Approver not found');

    const previousStatus = leaveRequest.status;
    leaveRequest.status = body.status;
    
    if (body.status === LeaveStatus.APPROVED || body.status === LeaveStatus.REJECTED) {
      leaveRequest.approvedBy = approver;
      leaveRequest.approvedAt = new Date();
    }
    if (body.reason) leaveRequest.reason = body.reason;

    const savedRequest = await this.leaveRequestRepo.save(leaveRequest);

    // Update leave balance when status changes
    const numberOfDays = this.calculateLeaveDays(leaveRequest.startUtc, leaveRequest.endUtc);
    const year = leaveRequest.startUtc.getFullYear();

    if (body.status === LeaveStatus.APPROVED && previousStatus !== LeaveStatus.APPROVED) {
      // Moving to APPROVED: increase usedDays, decrease pendingDays
      await this.updateLeaveBalanceOnApproval(leaveRequest.user.id, leaveRequest.leaveType.id, year, numberOfDays);
    } else if (previousStatus === LeaveStatus.APPROVED && body.status !== LeaveStatus.APPROVED) {
      // Moving from APPROVED to something else: decrease usedDays
      await this.updateLeaveBalanceOnRejection(leaveRequest.user.id, leaveRequest.leaveType.id, year, numberOfDays);
    }

    return savedRequest;
  }

  // Helper to calculate number of leave days
  private calculateLeaveDays(startUtc: Date, endUtc: Date): number {
    const startDate = new Date(startUtc);
    const endDate = new Date(endUtc);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1;
  }

  // ========== Leave Balance Methods ==========

  async getLeaveBalances(userId: string, year: number) {
    // Get all leave types and user's balances for the year
    const leaveTypes = await this.leaveTypeRepo.find({ where: { active: true } });
    const balances = await this.leaveBalanceRepo.find({
      where: { userId, year },
      relations: ['leaveType'],
    });

    // Create a map of existing balances
    const balanceMap = new Map(balances.map(b => [b.leaveTypeId, b]));

    // Return all leave types with their balance info
    return leaveTypes
      .filter(lt => 
        // Only include leave types that employees can request
        lt.name !== 'Present' && 
        lt.name !== 'Absent' && 
        lt.name !== 'Terminated / Leaver' &&
        lt.name !== 'AWOL'
      )
      .map(lt => {
        const balance = balanceMap.get(lt.id);
        return {
          leaveType: {
            id: lt.id,
            name: lt.name,
            paid: lt.paid,
          },
          year,
          entitledDays: balance ? Number(balance.entitledDays) : 0,
          usedDays: balance ? Number(balance.usedDays) : 0,
          pendingDays: balance ? Number(balance.pendingDays) : 0,
          remainingDays: balance ? Number(balance.entitledDays) - Number(balance.usedDays) : 0,
          balanceId: balance?.id || null,
        };
      })
      .sort((a, b) => a.leaveType.name.localeCompare(b.leaveType.name));
  }

  async assignLeaveEntitlement(dto: { userId: string; leaveTypeId: string; year?: number; entitledDays: number }) {
    const year = dto.year || new Date().getFullYear();
    
    // Check if user exists
    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');

    // Check if leave type exists
    const leaveType = await this.leaveTypeRepo.findOne({ where: { id: dto.leaveTypeId } });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    // Check if balance already exists
    let balance = await this.leaveBalanceRepo.findOne({
      where: { userId: dto.userId, leaveTypeId: dto.leaveTypeId, year },
    });

    if (balance) {
      // Update existing balance
      balance.entitledDays = dto.entitledDays;
    } else {
      // Create new balance
      balance = this.leaveBalanceRepo.create({
        userId: dto.userId,
        leaveTypeId: dto.leaveTypeId,
        year,
        entitledDays: dto.entitledDays,
        usedDays: 0,
        pendingDays: 0,
      });
    }

    return this.leaveBalanceRepo.save(balance);
  }

  async updateLeaveBalance(id: string, entitledDays: number) {
    const balance = await this.leaveBalanceRepo.findOne({ where: { id } });
    if (!balance) throw new NotFoundException('Leave balance not found');
    
    balance.entitledDays = entitledDays;
    return this.leaveBalanceRepo.save(balance);
  }

  async getAllLeaveBalances(year: number) {
    const balances = await this.leaveBalanceRepo.find({
      where: { year },
      relations: ['leaveType', 'user'],
    });

    return balances.map(b => ({
      id: b.id,
      user: {
        id: b.user?.id,
        fullName: b.user?.fullName,
        email: b.user?.email,
      },
      leaveType: {
        id: b.leaveType?.id,
        name: b.leaveType?.name,
      },
      year: b.year,
      entitledDays: Number(b.entitledDays),
      usedDays: Number(b.usedDays),
      pendingDays: Number(b.pendingDays),
      remainingDays: Number(b.entitledDays) - Number(b.usedDays),
    }));
  }

  private async updateLeaveBalanceOnApproval(userId: string, leaveTypeId: string, year: number, days: number) {
    let balance = await this.leaveBalanceRepo.findOne({
      where: { userId, leaveTypeId, year },
    });

    if (!balance) {
      // Create a new balance with 0 entitlement if doesn't exist
      balance = this.leaveBalanceRepo.create({
        userId,
        leaveTypeId,
        year,
        entitledDays: 0,
        usedDays: days,
        pendingDays: 0,
      });
    } else {
      balance.usedDays = Number(balance.usedDays) + days;
      balance.pendingDays = Math.max(0, Number(balance.pendingDays) - days);
    }

    await this.leaveBalanceRepo.save(balance);
  }

  private async updateLeaveBalanceOnRejection(userId: string, leaveTypeId: string, year: number, days: number) {
    const balance = await this.leaveBalanceRepo.findOne({
      where: { userId, leaveTypeId, year },
    });

    if (balance) {
      balance.usedDays = Math.max(0, Number(balance.usedDays) - days);
      await this.leaveBalanceRepo.save(balance);
    }
  }

  // Update pending days when leave request is created
  async updatePendingDays(userId: string, leaveTypeId: string, year: number, days: number) {
    let balance = await this.leaveBalanceRepo.findOne({
      where: { userId, leaveTypeId, year },
    });

    if (!balance) {
      balance = this.leaveBalanceRepo.create({
        userId,
        leaveTypeId,
        year,
        entitledDays: 0,
        usedDays: 0,
        pendingDays: days,
      });
    } else {
      balance.pendingDays = Number(balance.pendingDays) + days;
    }

    await this.leaveBalanceRepo.save(balance);
  }
}
