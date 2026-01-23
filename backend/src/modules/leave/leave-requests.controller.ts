import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { LeaveStatus } from '../../common/enums/leave-status.enum';

class LeaveRequestResponseDto {
  id: string;
  user: { id: string; fullName: string };
  campaign: { id: string; name: string };
  leaveType: { id: string; name: string };
  startUtc: Date;
  endUtc: Date;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: Date;
  reason?: string;
}

class CreateLeaveRequestDto {
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  reason?: string;
}

@ApiTags('leave-requests')
@Controller('leave-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LeaveRequestsController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Create a leave request' })
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  async create(@Body() dto: CreateLeaveRequestDto, @Req() req: any) {
    return this.leaveService.createLeaveRequest(dto, req.user.userId);
  }

  @Get()
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'List leave requests' })
  @ApiOkResponse({ type: [LeaveRequestResponseDto] })
  async findAll(@Query() query: { campaignId?: string; userId?: string; status?: LeaveStatus; from?: string; to?: string }, @Req() req: any) {
    return this.leaveService.findLeaveRequests(query, req.user);
  }

  @Patch(':id')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Approve or reject leave request' })
  @ApiOkResponse({ type: LeaveRequestResponseDto })
  async updateStatus(@Param('id') id: string, @Body() body: { status: LeaveStatus; reason?: string }, @Req() req: any) {
    return this.leaveService.updateLeaveRequestStatus(id, body, req.user.userId);
  }
}