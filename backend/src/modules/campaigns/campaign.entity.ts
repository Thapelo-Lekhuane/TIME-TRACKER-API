import {
  Column,
  Entity,
  Index,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  JoinTable,
} from 'typeorm';
import { User } from '../users/user.entity';

@Index(['name'])
@Index(['workDayStart'])
@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  // Alias field to match spec wording ("Campaign.timeZone").
  // We keep defaultTimeZone for backward compatibility in code/DB.
  @Column({ default: 'Africa/Johannesburg' })
  timeZone: string;

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

  // Email address of the person who receives leave request notifications
  @Column({ nullable: true })
  leaveApproverEmail: string;

  @OneToMany(() => User, (u) => u.campaign)
  users: User[];

  // Team leaders assigned to this campaign (many-to-many)
  @ManyToMany(() => User, (user) => user.teamLeaderCampaigns)
  @JoinTable({
    name: 'campaign_team_leaders',
    joinColumn: { name: 'campaignId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  teamLeaders: User[];
}
