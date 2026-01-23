import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TimeEvent } from './time-event.entity';
import { User } from '../users/user.entity';
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
  ) {}

  async create(eventTypeId: string, userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['campaign'],
    });
    if (!user || !user.campaign) {
      throw new BadRequestException('User not assigned to a campaign');
    }

    const eventType = await this.eventTypeRepo.findOne({
      where: { id: eventTypeId },
    });
    if (!eventType) {
      throw new BadRequestException('Invalid event type');
    }

    // Basic validation: e.g. cannot start work if already working
    // For now, simple: just create
    const timeEvent = this.repo.create({
      user,
      campaign: user.campaign,
      eventType,
      timestampUtc: new Date(),
      source: TimeEventSource.WEB,
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
