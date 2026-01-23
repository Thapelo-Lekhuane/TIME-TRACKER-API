import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Campaign } from '../campaigns/campaign.entity';

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
}
