import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './campaign.entity';
import { User } from '../users/user.entity';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private readonly repo: Repository<Campaign>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(user: any) {
    if (user.role === Role.ADMIN) {
      return this.repo.find({ relations: ['users'] });
    } else {
      // Manager: only their campaign
      const userEntity = await this.userRepo.findOne({
        where: { id: user.userId },
        relations: ['campaign'],
      });
      if (userEntity?.campaign) {
        return [userEntity.campaign];
      }
      return [];
    }
  }

  async create(dto: {
    name: string;
    description?: string;
    defaultTimeZone?: string;
    workDayStart?: string;
    workDayEnd?: string;
    lunchStart?: string;
    lunchEnd?: string;
    teaBreaks?: any[];
  }) {
    const campaign = this.repo.create({
      name: dto.name,
      description: dto.description,
      defaultTimeZone: dto.defaultTimeZone || 'Africa/Johannesburg',
      workDayStart: dto.workDayStart,
      workDayEnd: dto.workDayEnd,
      lunchStart: dto.lunchStart,
      lunchEnd: dto.lunchEnd,
      teaBreaks: dto.teaBreaks,
    });
    return this.repo.save(campaign);
  }

  async update(id: string, dto: any) {
    const campaign = await this.repo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    Object.assign(campaign, dto);
    return this.repo.save(campaign);
  }

  async assignUsers(campaignId: string, userIds: string[]) {
    const campaign = await this.repo.findOne({
      where: { id: campaignId },
      relations: ['users'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const users = await this.userRepo.findByIds(userIds);
    campaign.users = users;
    return this.repo.save(campaign);
  }
}
