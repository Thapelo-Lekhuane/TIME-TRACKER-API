import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty } from 'class-validator';

export class CreateTimeEventDto {
  @ApiProperty({ example: 'uuid', description: 'The ID of the event type (e.g., Work Start, Work End)' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  eventTypeId: string;
}