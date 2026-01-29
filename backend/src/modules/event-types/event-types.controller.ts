import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { EventTypesService } from './event-types.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { EventTypeResponseDto } from '../../common/dto/event-type-response.dto';
import { CreateEventTypeDto } from '../../common/dto/create-event-type.dto';
import { UsersService } from '../users/users.service';

@ApiTags('event-types')
@Controller('event-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EventTypesController {
  constructor(
    private readonly eventTypesService: EventTypesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all event types (for admin view)' })
  @ApiOkResponse({ type: [EventTypeResponseDto] })
  async findAll() {
    return this.eventTypesService.findAll();
  }

  @Get('available')
  @ApiOperation({ summary: 'Get event types available for the current user (global + campaign-specific)' })
  @ApiOkResponse({ type: [EventTypeResponseDto] })
  async findAvailableForUser(@Req() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    const campaignId = user?.campaign?.id || null;
    return this.eventTypesService.findForUser(campaignId);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get an event type by ID' })
  @ApiOkResponse({ type: EventTypeResponseDto })
  async findOne(@Param('id') id: string) {
    return this.eventTypesService.findById(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create an event type' })
  @ApiOkResponse({ type: EventTypeResponseDto })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'category'],
      properties: {
        name: { type: 'string', example: 'Meeting Start' },
        category: { type: 'string', enum: ['WORK', 'BREAK', 'LEAVE', 'OTHER'], example: 'WORK' },
        isPaid: { type: 'boolean', example: true },
        isBreak: { type: 'boolean', example: false },
        isGlobal: { type: 'boolean', example: true, description: 'If true, available to all employees' },
        campaignId: { type: 'string', nullable: true, description: 'If not global, specify the campaign ID' },
      },
    },
  })
  async create(@Body() dto: CreateEventTypeDto) {
    return this.eventTypesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update an event type' })
  @ApiOkResponse({ type: EventTypeResponseDto })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        category: { type: 'string', enum: ['WORK', 'BREAK', 'LEAVE', 'OTHER'] },
        isPaid: { type: 'boolean' },
        isBreak: { type: 'boolean' },
        isGlobal: { type: 'boolean' },
        campaignId: { type: 'string', nullable: true },
        active: { type: 'boolean' },
      },
    },
  })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateEventTypeDto>) {
    return this.eventTypesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete an event type' })
  async delete(@Param('id') id: string) {
    return this.eventTypesService.delete(id);
  }
}
