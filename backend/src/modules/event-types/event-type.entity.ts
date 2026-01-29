import { Column, Entity, Index, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EventCategory } from '../../common/enums/event-category.enum';
import { Campaign } from '../campaigns/campaign.entity';

@Index(['isGlobal'])
@Index(['campaignId'])
@Index(['active'])
@Index(['category'])
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

  // If true, this event type is available to ALL employees regardless of campaign assignment
  // Default event types (Work Start, Work End, breaks) should be global
  @Column({ default: true })
  isGlobal: boolean;

  // If not global, this event type belongs to a specific campaign
  @ManyToOne(() => Campaign, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign | null;

  @Column({ nullable: true })
  campaignId: string | null;
}
