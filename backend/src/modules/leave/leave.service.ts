import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LeaveType } from './leave-type.entity';
import { LeaveRequest } from './leave-request.entity';
import { User } from '../users/user.entity';
import { LeaveStatus } from '../../common/enums/leave-status.enum';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveType)
    private readonly leaveTypeRepo: Repository<LeaveType>,
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

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
    return types.sort((a, b) => {
      const aIndex = order.indexOf(a.name);
      const bIndex = order.indexOf(b.name);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }

  async createLeaveType(dto: {
    name: string;
    paid?: boolean;
    fullDayAllowed?: boolean;
    halfDayAllowed?: boolean;
  }) {
    const leaveType = this.leaveTypeRepo.create({
      name: dto.name,
      paid: dto.paid ?? true,
      fullDayAllowed: dto.fullDayAllowed ?? true,
      halfDayAllowed: dto.halfDayAllowed ?? true,
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
      throw new BadRequestException('User not assigned to a campaign');
    }

    const leaveType = await this.leaveTypeRepo.findOne({
      where: { id: dto.leaveTypeId },
    });
    if (!leaveType) {
      throw new BadRequestException('Invalid leave type');
    }

    const startUtc = new Date(dto.startDate + 'T00:00:00Z');
    const endUtc = new Date(dto.endDate + 'T23:59:59Z');

    const leaveRequest = this.leaveRequestRepo.create({
      user,
      campaign: user.campaign,
      leaveType,
      startUtc,
      endUtc,
      status: LeaveStatus.PENDING,
      reason: dto.reason,
    });
    return this.leaveRequestRepo.save(leaveRequest);
  }

  async findLeaveRequests(query: { campaignId?: string; userId?: string; status?: LeaveStatus; from?: string; to?: string }, user: any) {
    const where: any = {};
    if (query.campaignId) where.campaign = { id: query.campaignId };
    if (query.userId) where.user = { id: query.userId };
    if (query.status) where.status = query.status;

    if (user.role === Role.MANAGER) {
      // Managers see only their campaign
      const userEntity = await this.userRepo.findOne({
        where: { id: user.userId },
        relations: ['campaign'],
      });
      if (userEntity?.campaign) {
        where.campaign = { id: userEntity.campaign.id };
      } else {
        return [];
      }
    }

    const queryBuilder = this.leaveRequestRepo
      .createQueryBuilder('leaveRequest')
      .leftJoinAndSelect('leaveRequest.user', 'user')
      .leftJoinAndSelect('leaveRequest.campaign', 'campaign')
      .leftJoinAndSelect('leaveRequest.leaveType', 'leaveType')
      .where(where);

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

    return queryBuilder.orderBy('leaveRequest.startUtc', 'DESC').getMany();
  }

  async updateLeaveRequestStatus(id: string, body: { status: LeaveStatus; reason?: string }, approverId: string) {
    const leaveRequest = await this.leaveRequestRepo.findOne({
      where: { id },
      relations: ['user', 'campaign', 'leaveType', 'approvedBy'],
    });
    if (!leaveRequest) throw new NotFoundException('Leave request not found');

    const approver = await this.userRepo.findOne({ where: { id: approverId } });
    if (!approver) throw new NotFoundException('Approver not found');

    leaveRequest.status = body.status;
    if (body.status === LeaveStatus.APPROVED || body.status === LeaveStatus.REJECTED) {
      leaveRequest.approvedBy = approver;
      leaveRequest.approvedAt = new Date();
    }
    if (body.reason) leaveRequest.reason = body.reason;

    return this.leaveRequestRepo.save(leaveRequest);
  }
}
