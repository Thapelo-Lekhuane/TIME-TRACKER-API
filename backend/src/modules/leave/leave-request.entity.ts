import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { LeaveType } from './leave-type.entity';
import { LeaveStatus } from '../../common/enums/leave-status.enum';

@Index(['user', 'startUtc'])
@Index(['campaign', 'startUtc'])
@Index(['status'])
@Index(['startUtc', 'endUtc'])
@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  user: User;

  @ManyToOne(() => Campaign, { nullable: false })
  campaign: Campaign;

  @ManyToOne(() => LeaveType, { nullable: false })
  leaveType: LeaveType;

  @Column({ type: 'timestamptz' })
  startUtc: Date;

  @Column({ type: 'timestamptz' })
  endUtc: Date;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @ManyToOne(() => User, { nullable: true })
  approvedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;
}