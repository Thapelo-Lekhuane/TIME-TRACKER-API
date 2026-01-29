import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { EventCategory } from '../enums/event-category.enum';

export class CreateEventTypeDto {
  @ApiProperty({ example: 'Start Work' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'WORK', enum: EventCategory })
  @IsEnum(EventCategory)
  category: EventCategory;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isBreak?: boolean;

  @ApiProperty({ example: true, required: false, description: 'If true, available to all employees regardless of campaign' })
  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean;

  @ApiProperty({ example: null, required: false, description: 'Campaign ID if this event type is campaign-specific' })
  @IsUUID()
  @IsOptional()
  campaignId?: string | null;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}