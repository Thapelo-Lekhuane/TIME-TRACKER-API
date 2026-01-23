import { ApiProperty, ApiExtraModels } from '@nestjs/swagger';

export class DailyAttendanceEntryDto {
  @ApiProperty({ example: 'PRESENT' })
  status: string;

  @ApiProperty({ example: 480 })
  workMinutes: number;

  @ApiProperty({ example: 60 })
  breakMinutes: number;
}

@ApiExtraModels(DailyAttendanceEntryDto)
export class AttendanceDailyResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'object', additionalProperties: { $ref: '#/components/schemas/DailyAttendanceEntryDto' } }, description: 'Map of userId to their daily attendance data' })
  data: Record<string, Record<string, DailyAttendanceEntryDto>>;
}