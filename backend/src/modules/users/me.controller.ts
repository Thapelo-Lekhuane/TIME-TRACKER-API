import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TimeEventsService } from '../time-events/time-events.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { TimeEventResponseDto } from '../../common/dto/time-event-response.dto';

@ApiTags('me')
@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MeController {
  constructor(private readonly timeEventsService: TimeEventsService) {}

  @Get('time-events')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get my time events for a date' })
  @ApiOkResponse({ type: [TimeEventResponseDto] })
  async getMyTimeEvents(@Query('date') date: string, @Req() req: any) {
    return this.timeEventsService.findByUserAndDate(req.user.userId, date);
  }
}
