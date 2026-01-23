import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash } from 'bcrypt';
import { User } from './user.entity';
import { Role } from '../../common/enums/role.enum';

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
    return this.repo.findOne({ where: { id }, relations: ['campaign'] });
  }

  async findAll() {
    return this.repo.find({ relations: ['campaign'] });
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

  async createAdmin(email: string, password: string, timeZone: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      // Update password if changed
      const passwordHash = await hash(password, 10);
      existing.passwordHash = passwordHash;
      existing.timeZone = timeZone;
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
