import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEmail } from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Project Alpha' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Main project', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Africa/Johannesburg', required: false })
  @IsString()
  @IsOptional()
  timeZone?: string;

  @ApiProperty({ example: 'America/New_York', required: false })
  @IsString()
  @IsOptional()
  defaultTimeZone?: string;

  @ApiProperty({ example: '09:00', required: false })
  @IsString()
  @IsOptional()
  workDayStart?: string;

  @ApiProperty({ example: '17:00', required: false })
  @IsString()
  @IsOptional()
  workDayEnd?: string;

  @ApiProperty({ example: '12:00', required: false })
  @IsString()
  @IsOptional()
  lunchStart?: string;

  @ApiProperty({ example: '13:00', required: false })
  @IsString()
  @IsOptional()
  lunchEnd?: string;

  @ApiProperty({ type: [Object], required: false })
  @IsArray()
  @IsOptional()
  teaBreaks?: any[];

  @ApiProperty({ example: 'leave-approver@company.com', required: false, description: 'Email address to receive leave request notifications' })
  @IsEmail()
  @IsOptional()
  leaveApproverEmail?: string;
}