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
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('leave-balances')
@Controller('leave-balances')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class LeaveBalanceController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('me')
  @Roles(Role.EMPLOYEE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get my leave balances for current year' })
  async getMyBalances(@Req() req: any, @Query('year') year?: string) {
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    return this.leaveService.getLeaveBalances(req.user.userId, targetYear);
  }

  @Get('user/:userId')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: 'Get leave balances for a specific user (Manager/Admin)' })
  async getUserBalances(@Param('userId') userId: string, @Query('year') year?: string) {
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    return this.leaveService.getLeaveBalances(userId, targetYear);
  }

  @Post('assign')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Assign leave entitlement to a user' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userId', 'leaveTypeId', 'entitledDays'],
      properties: {
        userId: { type: 'string' },
        leaveTypeId: { type: 'string' },
        year: { type: 'number', description: 'Year for the entitlement (defaults to current year)' },
        entitledDays: { type: 'number', description: 'Number of days to entitle' },
      },
    },
  })
  async assignLeaveEntitlement(@Body() dto: { userId: string; leaveTypeId: string; year?: number; entitledDays: number }) {
    return this.leaveService.assignLeaveEntitlement(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update leave balance entitlement' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        entitledDays: { type: 'number' },
      },
    },
  })
  async updateLeaveBalance(@Param('id') id: string, @Body() dto: { entitledDays: number }) {
    return this.leaveService.updateLeaveBalance(id, dto.entitledDays);
  }

  @Get('all')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all leave balances (Admin)' })
  async getAllBalances(@Query('year') year?: string) {
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    return this.leaveService.getAllLeaveBalances(targetYear);
  }
}
