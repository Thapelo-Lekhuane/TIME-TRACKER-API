import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../enums/role.enum';

export class UserResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiProperty({ example: 'Software Engineer', required: false })
  designation?: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: 'America/New_York' })
  timeZone: string;

  @ApiProperty({ type: Object, required: false })
  campaign?: { id: string; name: string };
}