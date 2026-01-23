import { ApiProperty } from '@nestjs/swagger';

export class CampaignResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Project Alpha' })
  name: string;

  @ApiProperty({ example: 'Main project', required: false })
  description?: string;

  @ApiProperty({ example: 'America/New_York' })
  defaultTimeZone: string;

  @ApiProperty({ example: '09:00', required: false })
  workDayStart?: string;

  @ApiProperty({ example: '17:00', required: false })
  workDayEnd?: string;

  @ApiProperty({ example: '12:00', required: false })
  lunchStart?: string;

  @ApiProperty({ example: '13:00', required: false })
  lunchEnd?: string;

  @ApiProperty({ type: [Object], required: false })
  teaBreaks?: any[];
}