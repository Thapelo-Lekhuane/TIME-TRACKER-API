import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { EventType } from '../event-types/event-type.entity';
import { TimeEventSource } from '../../common/enums/time-event-source.enum';

@Index(['user', 'timestampUtc'])
@Index(['campaign', 'timestampUtc'])
@Index(['eventType'])
@Index(['timestampUtc'])
@Index(['lateMinutes'])
@Entity('time_events')
export class TimeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false, nullable: false })
  user: User;

  // Campaign can be null for global event types (users without campaign assignment)
  @ManyToOne(() => Campaign, { eager: false, nullable: true })
  campaign: Campaign | null;

  @ManyToOne(() => EventType, { eager: true, nullable: false })
  eventType: EventType;

  @Column({ type: 'timestamptz' })
  timestampUtc: Date;

  @Column({ type: 'enum', enum: TimeEventSource, default: TimeEventSource.WEB })
  source: TimeEventSource;

  // Late tracking: minutes late if this is a work start event
  @Column({ type: 'integer', nullable: true })
  lateMinutes: number | null;
}
