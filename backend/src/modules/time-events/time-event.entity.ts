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
@Entity('time_events')
export class TimeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false, nullable: false })
  user: User;

  @ManyToOne(() => Campaign, { eager: false, nullable: false })
  campaign: Campaign;

  @ManyToOne(() => EventType, { eager: true, nullable: false })
  eventType: EventType;

  @Column({ type: 'timestamptz' })
  timestampUtc: Date;

  @Column({ type: 'enum', enum: TimeEventSource, default: TimeEventSource.WEB })
  source: TimeEventSource;
}
