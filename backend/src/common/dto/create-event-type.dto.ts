import { ApiProperty } from '@nestjs/swagger';
import { EventCategory } from '../enums/event-category.enum';

export class CreateEventTypeDto {
  @ApiProperty({ example: 'Start Work' })
  name: string;

  @ApiProperty({ example: 'WORK', enum: EventCategory })
  category: EventCategory;

  @ApiProperty({ example: true, required: false })
  isPaid?: boolean;

  @ApiProperty({ example: false, required: false })
  isBreak?: boolean;
}