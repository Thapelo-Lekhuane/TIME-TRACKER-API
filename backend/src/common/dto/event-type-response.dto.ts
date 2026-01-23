import { ApiProperty } from '@nestjs/swagger';

export class EventTypeResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Start Work' })
  name: string;

  @ApiProperty({ example: 'WORK' })
  category: string;

  @ApiProperty({ example: true })
  isPaid: boolean;

  @ApiProperty({ example: false })
  isBreak: boolean;

  @ApiProperty({ example: true })
  active: boolean;
}