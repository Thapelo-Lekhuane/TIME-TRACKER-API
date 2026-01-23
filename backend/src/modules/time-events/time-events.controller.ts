import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TimeEventsService } from './time-events.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { TimeEventResponseDto } from '../../common/dto/time-event-response.dto';
import { CreateTimeEventDto } from '../../common/dto/create-time-event.dto';

@ApiTags('time-events')
@Controller('time-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TimeEventsController {
  constructor(private readonly timeEventsService: TimeEventsService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Clock in/out or break' })
  @ApiOkResponse({ type: TimeEventResponseDto })
  async create(@Body() dto: CreateTimeEventDto, @Req() req: any) {
    return this.timeEventsService.create(dto.eventTypeId, req.user.userId);
  }
}
