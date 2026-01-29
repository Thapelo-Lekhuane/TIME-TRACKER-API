import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LeaveStatus } from '../enums/leave-status.enum';

export class UpdateLeaveStatusDto {
  @ApiProperty({ enum: LeaveStatus, example: 'APPROVED' })
  @IsEnum(LeaveStatus)
  status: LeaveStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
