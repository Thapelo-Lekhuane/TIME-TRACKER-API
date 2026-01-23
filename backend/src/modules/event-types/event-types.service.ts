import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventType } from './event-type.entity';
import { EventCategory } from '../../common/enums/event-category.enum';

@Injectable()
export class EventTypesService {
  constructor(
    @InjectRepository(EventType)
    private readonly repo: Repository<EventType>,
  ) {}

  async findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async create(dto: {
    name: string;
    category: EventCategory;
    isPaid?: boolean;
    isBreak?: boolean;
  }) {
    const eventType = this.repo.create({
      name: dto.name,
      category: dto.category,
      isPaid: dto.isPaid ?? false,
      isBreak: dto.isBreak ?? false,
      active: true,
    });
    return this.repo.save(eventType);
  }

  async seedDefaultEventTypes() {
    const defaultTypes = [
      { name: 'Work Start', category: EventCategory.WORK, isPaid: true, isBreak: false },
      { name: 'Work End', category: EventCategory.WORK, isPaid: true, isBreak: false },
      { name: 'Lunch Start', category: EventCategory.BREAK, isPaid: false, isBreak: true },
      { name: 'Lunch End', category: EventCategory.BREAK, isPaid: false, isBreak: true },
      { name: 'Tea Break Start', category: EventCategory.BREAK, isPaid: false, isBreak: true },
      { name: 'Tea Break End', category: EventCategory.BREAK, isPaid: false, isBreak: true },
    ];

    for (const type of defaultTypes) {
      const existing = await this.repo.findOne({ where: { name: type.name } });
      if (!existing) {
        await this.create(type);
      }
    }
  }

  async update(id: string, dto: any) {
    const eventType = await this.repo.findOne({ where: { id } });
    if (!eventType) throw new NotFoundException('Event type not found');
    Object.assign(eventType, dto);
    return this.repo.save(eventType);
  }
}
