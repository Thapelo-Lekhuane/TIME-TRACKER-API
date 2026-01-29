import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index(['active'])
@Index(['sortOrder'])
@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  // Persisted ordering so API/UI can sort consistently (Excel order).
  @Column({ type: 'int', default: 9999 })
  sortOrder: number;

  @Column({ default: true })
  paid: boolean;

  @Column({ default: true })
  fullDayAllowed: boolean;

  @Column({ default: true })
  halfDayAllowed: boolean;

  @Column({ default: true })
  active: boolean;
}