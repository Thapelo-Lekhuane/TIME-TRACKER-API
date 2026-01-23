import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ default: true })
  paid: boolean;

  @Column({ default: true })
  fullDayAllowed: boolean;

  @Column({ default: true })
  halfDayAllowed: boolean;

  @Column({ default: true })
  active: boolean;
}