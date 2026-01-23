import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'Africa/Johannesburg' })
  defaultTimeZone: string;

  @Column({ type: 'time', nullable: true })
  workDayStart: string; // e.g. '09:00:00'

  @Column({ type: 'time', nullable: true })
  workDayEnd: string; // e.g. '17:00:00'

  @Column({ type: 'time', nullable: true })
  lunchStart: string; // e.g. '12:00:00'

  @Column({ type: 'time', nullable: true })
  lunchEnd: string; // e.g. '13:00:00'

  @Column({ type: 'jsonb', nullable: true })
  teaBreaks: { start: string; end: string }[]; // e.g. [{start: '10:00', end: '10:15'}]

  @OneToMany(() => User, (u) => u.campaign)
  users: User[];
}
