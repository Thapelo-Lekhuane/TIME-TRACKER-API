import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { hash } from 'bcrypt';
import { User } from './user.entity';
import { Role } from '../../common/enums/role.enum';
import { Campaign } from '../campaigns/campaign.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['campaign', 'teamLeader'] });
  }

  async findAll() {
    return this.repo.find({ relations: ['campaign', 'teamLeader'] });
  }

  // Find users not assigned to any campaign
  async findAvailable() {
    return this.repo.find({
      where: { campaign: IsNull() },
      relations: ['campaign'],
    });
  }

  async create(dto: {
    email: string;
    password: string;
    fullName: string;
    designation?: string;
    campaignId?: string;
    timeZone?: string;
  }) {
    const passwordHash = await hash(dto.password, 10);
    const user = this.repo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      fullName: dto.fullName,
      designation: dto.designation,
      role: Role.EMPLOYEE,
      timeZone: dto.timeZone || 'Africa/Johannesburg',
      campaign: dto.campaignId ? { id: dto.campaignId } : undefined,
    });
    return this.repo.save(user);
  }

  async updateRole(id: string, role: Role) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    return this.repo.save(user);
  }

  async updateUser(id: string, dto: {
    fullName?: string;
    designation?: string;
    role?: Role;
    campaignId?: string | null;
    timeZone?: string;
    status?: string;
    teamLeaderId?: string | null;
  }) {
    const user = await this.repo.findOne({ where: { id }, relations: ['campaign', 'teamLeader'] });
    if (!user) throw new NotFoundException('User not found');
    
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.designation !== undefined) user.designation = dto.designation;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.timeZone !== undefined) user.timeZone = dto.timeZone;
    if (dto.status !== undefined) user.status = dto.status;
    
    // Handle campaign assignment
    if (dto.campaignId === null) {
      user.campaign = null as any;
    } else if (dto.campaignId !== undefined) {
      user.campaign = { id: dto.campaignId } as Campaign;
    }
    
    // Handle team leader assignment
    if (dto.teamLeaderId === null) {
      user.teamLeader = null as any;
      user.teamLeaderId = null;
    } else if (dto.teamLeaderId !== undefined) {
      const teamLeader = await this.repo.findOne({ where: { id: dto.teamLeaderId } });
      if (!teamLeader) throw new NotFoundException('Team leader not found');
      user.teamLeader = teamLeader;
      user.teamLeaderId = dto.teamLeaderId;
    }
    
    return this.repo.save(user);
  }

  async createAdmin(email: string, password: string, timeZone: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      // Ensure existing user is promoted to ADMIN (bootstrap must be idempotent).
      const passwordHash = await hash(password, 10);
      existing.passwordHash = passwordHash;
      existing.timeZone = timeZone;
      existing.role = Role.ADMIN;
      if (!existing.fullName) existing.fullName = 'System Admin';
      return this.repo.save(existing);
    }

    const passwordHash = await hash(password, 10);
    const admin = this.repo.create({
      email: email.toLowerCase(),
      passwordHash,
      fullName: 'System Admin',
      role: Role.ADMIN,
      timeZone,
    });
    return this.repo.save(admin);
  }
}
