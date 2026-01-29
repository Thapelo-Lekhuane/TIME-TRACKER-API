import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Or, Equal } from 'typeorm';
import { EventType } from './event-type.entity';
import { EventCategory } from '../../common/enums/event-category.enum';

@Injectable()
export class EventTypesService {
  private readonly logger = new Logger(EventTypesService.name);

  constructor(
    @InjectRepository(EventType)
    private readonly repo: Repository<EventType>,
  ) {}

  // Find all event types (admin view)
  async findAll() {
    return this.repo.find({ 
      order: { name: 'ASC' },
      relations: ['campaign'],
    });
  }

  // Find event types available for a specific user
  // Returns global events + events for their campaign (if assigned)
  async findForUser(campaignId: string | null) {
    if (campaignId) {
      // User has a campaign: show global events + their campaign's events
      return this.repo.find({
        where: [
          { isGlobal: true, active: true },
          { campaignId: campaignId, active: true },
        ],
        order: { name: 'ASC' },
      });
    } else {
      // User has no campaign: show only global events
      return this.repo.find({
        where: { isGlobal: true, active: true },
        order: { name: 'ASC' },
      });
    }
  }

  async findById(id: string) {
    return this.repo.findOne({ 
      where: { id },
      relations: ['campaign'],
    });
  }

  async create(dto: {
    name: string;
    category: EventCategory;
    isPaid?: boolean;
    isBreak?: boolean;
    isGlobal?: boolean;
    campaignId?: string | null;
  }) {
    // Check for duplicate name
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException(`Event type "${dto.name}" already exists`);
    }

    const eventType = this.repo.create({
      name: dto.name,
      category: dto.category,
      isPaid: dto.isPaid ?? false,
      isBreak: dto.isBreak ?? false,
      isGlobal: dto.isGlobal ?? true,
      campaignId: dto.campaignId ?? null,
      active: true,
    });
    return this.repo.save(eventType);
  }

  async seedDefaultEventTypes() {
    const defaultTypes = [
      { name: 'Work Start', category: EventCategory.WORK, isPaid: true, isBreak: false, isGlobal: true },
      { name: 'Work End', category: EventCategory.WORK, isPaid: true, isBreak: false, isGlobal: true },
      { name: 'Lunch Start', category: EventCategory.BREAK, isPaid: false, isBreak: true, isGlobal: true },
      { name: 'Lunch End', category: EventCategory.BREAK, isPaid: false, isBreak: true, isGlobal: true },
      { name: 'Tea Break Start', category: EventCategory.BREAK, isPaid: false, isBreak: true, isGlobal: true },
      { name: 'Tea Break End', category: EventCategory.BREAK, isPaid: false, isBreak: true, isGlobal: true },
    ];

    for (const type of defaultTypes) {
      const existing = await this.repo.findOne({ where: { name: type.name } });
      if (!existing) {
        const eventType = this.repo.create({
          ...type,
          active: true,
        });
        await this.repo.save(eventType);
        this.logger.log(`Created event type: ${type.name}`);
      } else {
        // Ensure existing default types are marked as global
        if (!existing.isGlobal) {
          existing.isGlobal = true;
          await this.repo.save(existing);
          this.logger.log(`Updated event type "${type.name}" to global`);
        }
      }
    }
  }

  async update(id: string, dto: {
    name?: string;
    category?: EventCategory;
    isPaid?: boolean;
    isBreak?: boolean;
    isGlobal?: boolean;
    campaignId?: string | null;
    active?: boolean;
  }) {
    const eventType = await this.repo.findOne({ where: { id } });
    if (!eventType) throw new NotFoundException('Event type not found');

    // If changing name, check for duplicates
    if (dto.name && dto.name !== eventType.name) {
      const existing = await this.repo.findOne({ where: { name: dto.name } });
      if (existing) {
        throw new BadRequestException(`Event type "${dto.name}" already exists`);
      }
    }

    Object.assign(eventType, dto);
    return this.repo.save(eventType);
  }

  async delete(id: string) {
    const eventType = await this.repo.findOne({ where: { id } });
    if (!eventType) throw new NotFoundException('Event type not found');
    
    await this.repo.remove(eventType);
    return { message: 'Event type deleted successfully' };
  }
}
