import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { LeaveType } from './leave-type.entity';

@Index(['user', 'year'])
@Index(['leaveType'])
@Index(['year'])
@Entity('leave_balances')
@Unique(['user', 'leaveType', 'year'])
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: false, nullable: false, onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => LeaveType, { eager: true, nullable: false, onDelete: 'CASCADE' })
  leaveType: LeaveType;

  @Column()
  leaveTypeId: string;

  // The year this balance applies to (e.g., 2026)
  @Column({ type: 'int' })
  year: number;

  // Total entitled days for this leave type for this year
  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  entitledDays: number;

  // Days already used (approved leave)
  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  usedDays: number;

  // Days pending approval
  @Column({ type: 'decimal', precision: 5, scale: 1, default: 0 })
  pendingDays: number;

  // Remaining balance = entitledDays - usedDays
  get remainingDays(): number {
    return Number(this.entitledDays) - Number(this.usedDays);
  }
}
