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
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { UserResponseDto } from '../../common/dto/user-response.dto';
import { CreateUserDto } from '../../common/dto/create-user.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List all users (Admin and Manager)' })
  @ApiOkResponse({ type: [UserResponseDto] })
  @ApiQuery({ name: 'available', required: false, type: Boolean, description: 'If true, return only users not assigned to any campaign' })
  async findAll(@Query('available') available?: string) {
    if (available === 'true') {
      return this.usersService.findAvailable();
    }
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  async getMe(@Req() req: any) {
    return this.usersService.findById(req.user.userId);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiOkResponse({ type: UserResponseDto })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user details (role, campaign, designation, etc.)' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string' },
        designation: { type: 'string' },
        role: { type: 'string', enum: ['ADMIN', 'MANAGER', 'EMPLOYEE'] },
        campaignId: { type: 'string', nullable: true, description: 'Set to null to unassign from campaign' },
        timeZone: { type: 'string' },
        status: { type: 'string' },
        teamLeaderId: { type: 'string', nullable: true, description: 'Set to null to unassign team leader' },
      },
    },
  })
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.usersService.updateUser(id, body);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user role (legacy endpoint)' })
  @ApiOkResponse({ type: UserResponseDto })
  async updateRole(@Param('id') id: string, @Body() body: { role: Role }) {
    return this.usersService.updateRole(id, body.role);
  }
}
