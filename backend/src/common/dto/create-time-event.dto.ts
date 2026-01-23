import { ApiProperty } from '@nestjs/swagger';

export class CreateTimeEventDto {
  @ApiProperty({ example: 'uuid' })
  eventTypeId: string;
}