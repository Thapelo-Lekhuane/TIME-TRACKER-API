import {
  Column,
  Entity,
  Index,
  ManyToOne,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Campaign } from '../campaigns/campaign.entity';

@Index(['email'])
@Index(['role'])
@Index(['campaign'])
@Index(['teamLeaderId'])
@Index(['status'])
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  designation: string;

  @Column({ type: 'enum', enum: Role, default: Role.EMPLOYEE })
  role: Role;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ default: 'Africa/Johannesburg' })
  timeZone: string;

  @ManyToOne(() => Campaign, (c) => c.users, { nullable: true })
  campaign: Campaign;

  // Team Leader relationship - a user can have a team leader assigned
  @ManyToOne(() => User, { nullable: true })
  teamLeader: User | null;

  @Column({ nullable: true })
  teamLeaderId: string | null;

  // Campaigns where this user is a team leader (many-to-many)
  @ManyToMany(() => Campaign, (campaign) => campaign.teamLeaders)
  teamLeaderCampaigns: Campaign[];
}
