import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsNotEmpty, Matches } from 'class-validator';

export class CreateLeaveRequestDto {
  @ApiProperty({ example: 'uuid', description: 'Leave type ID' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @ApiProperty({ example: '2026-01-15', description: 'Start date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate: string;

  @ApiProperty({ example: '2026-01-20', description: 'End date (YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate: string;

  @ApiProperty({ example: 'Family vacation', required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
