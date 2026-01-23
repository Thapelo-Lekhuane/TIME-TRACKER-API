import { ApiProperty } from '@nestjs/swagger';

export class TimeEventResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ type: Object })
  eventType: { id: string; name: string; category: string };

  @ApiProperty({ example: '2023-01-01T09:00:00.000Z' })
  timestampUtc: Date;

  @ApiProperty({ example: 'WEB' })
  source: string;
}