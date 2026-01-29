import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TimeEvent } from './time-event.entity';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { EventType } from '../event-types/event-type.entity';
import { TimeEventSource } from '../../common/enums/time-event-source.enum';

@Injectable()
export class TimeEventsService {
  constructor(
    @InjectRepository(TimeEvent)
    private readonly repo: Repository<TimeEvent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EventType)
    private readonly eventTypeRepo: Repository<EventType>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
  ) {}

  async create(eventTypeId: string, userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['campaign'],
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const eventType = await this.eventTypeRepo.findOne({
      where: { id: eventTypeId },
    });
    if (!eventType) {
      throw new BadRequestException('Invalid event type');
    }

    // Check if user can use this event type:
    // - Global events: available to all users (even without campaign)
    // - Campaign-specific events: only available if user is in that campaign
    if (!eventType.isGlobal) {
      // Non-global event: user must be assigned to the event's campaign
      if (!user.campaign) {
        throw new BadRequestException('You are not assigned to a campaign. Please contact your manager or admin to be assigned to a campaign.');
      }
      if (eventType.campaignId && eventType.campaignId !== user.campaign.id) {
        throw new BadRequestException('This event type is not available for your campaign');
      }
    }

    // Calculate late minutes if this is a work start event
    let lateMinutes: number | null = null;
    if (eventType.name.includes('Work Start') && user.campaign && user.campaign.workDayStart) {
      const now = new Date();
      const campaign = await this.campaignRepo.findOne({
        where: { id: user.campaign.id },
      });
      
      if (campaign && campaign.workDayStart) {
        // Parse work start time (format: HH:MM:SS)
        const [hours, minutes] = campaign.workDayStart.split(':').map(Number);
        const workStartTime = new Date(now);
        workStartTime.setHours(hours, minutes, 0, 0);
        
        // Calculate difference in minutes
        const diffMs = now.getTime() - workStartTime.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        // Only mark as late if positive (after start time)
        if (diffMinutes > 0) {
          lateMinutes = diffMinutes;
        }
      }
    }

    // Basic validation: e.g. cannot start work if already working
    // For now, simple: just create
    const timeEvent = this.repo.create({
      user,
      campaign: user.campaign || null, // Campaign can be null for global events
      eventType,
      timestampUtc: new Date(),
      source: TimeEventSource.WEB,
      lateMinutes,
    });
    return this.repo.save(timeEvent);
  }

  async findByUserAndDate(userId: string, date: string) {
    const start = new Date(date + 'T00:00:00Z');
    const end = new Date(date + 'T23:59:59Z');
    return this.repo.find({
      where: {
        user: { id: userId },
        timestampUtc: Between(start, end),
      },
      relations: ['eventType'],
      order: { timestampUtc: 'ASC' },
    });
  }
}
