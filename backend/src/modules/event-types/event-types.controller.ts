import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventTypesService } from './event-types.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { EventTypeResponseDto } from '../../common/dto/event-type-response.dto';
import { CreateEventTypeDto } from '../../common/dto/create-event-type.dto';

@ApiTags('event-types')
@Controller('event-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EventTypesController {
  constructor(private readonly eventTypesService: EventTypesService) {}

  @Get()
  @ApiOperation({ summary: 'List all event types' })
  @ApiOkResponse({ type: [EventTypeResponseDto] })
  async findAll() {
    return this.eventTypesService.findAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create an event type' })
  @ApiOkResponse({ type: EventTypeResponseDto })
  async create(@Body() dto: CreateEventTypeDto) {
    return this.eventTypesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update an event type' })
  @ApiOkResponse({ type: EventTypeResponseDto })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateEventTypeDto>) {
    return this.eventTypesService.update(id, dto);
  }
}
