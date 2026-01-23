import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EventCategory } from '../../common/enums/event-category.enum';

@Entity('event_types')
export class EventType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // e.g. "Start work", "End work"

  @Column({ type: 'enum', enum: EventCategory, default: EventCategory.WORK })
  category: EventCategory;

  @Column({ default: false })
  isPaid: boolean;

  @Column({ default: false })
  isBreak: boolean;

  @Column({ default: true })
  active: boolean;
}
