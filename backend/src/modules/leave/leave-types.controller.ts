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
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

class LeaveTypeResponseDto {
  id: string;
  name: string;
  paid: boolean;
  fullDayAllowed: boolean;
  halfDayAllowed: boolean;
  active: boolean;
}

class CreateLeaveTypeDto {
  name: string;
  paid?: boolean;
  fullDayAllowed?: boolean;
  halfDayAllowed?: boolean;
}

@ApiTags('leave-types')
@Controller('leave-types')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LeaveTypesController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get()
  @ApiOperation({ summary: 'List leave types in order' })
  @ApiOkResponse({ type: [LeaveTypeResponseDto] })
  async findAll() {
    return this.leaveService.findAllLeaveTypes();
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a leave type' })
  @ApiOkResponse({ type: LeaveTypeResponseDto })
  async create(@Body() dto: CreateLeaveTypeDto) {
    return this.leaveService.createLeaveType(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a leave type' })
  @ApiOkResponse({ type: LeaveTypeResponseDto })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateLeaveTypeDto>) {
    return this.leaveService.updateLeaveType(id, dto);
  }
}
