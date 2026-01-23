import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'password123' })
  password: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiProperty({ example: 'Software Engineer', required: false })
  designation?: string;

  @ApiProperty({ example: 'uuid', required: false })
  campaignId?: string;

  @ApiProperty({ example: 'America/New_York', required: false })
  timeZone?: string;
}