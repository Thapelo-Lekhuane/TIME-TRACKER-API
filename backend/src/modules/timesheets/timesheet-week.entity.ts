import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';

@Entity('timesheet_weeks')
export class TimesheetWeek {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @ManyToOne(() => Campaign, { nullable: false })
  campaign: Campaign;

  @Column({ type: 'date' })
  weekStartDate: string; // e.g. '2026-01-20'

  @Column({ type: 'int', default: 0 })
  totalWorkMinutes: number;

  @Column({ type: 'int', default: 0 })
  totalBreakMinutes: number;

  @Column({ type: 'int', default: 0 })
  totalLeaveMinutes: number;

  @Column({ default: 'DRAFT' })
  status: string; // DRAFT, SUBMITTED, APPROVED
}