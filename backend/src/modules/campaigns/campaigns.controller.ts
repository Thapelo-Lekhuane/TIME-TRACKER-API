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
import { CampaignsService } from './campaigns.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CampaignResponseDto } from '../../common/dto/campaign-response.dto';
import { CreateCampaignDto } from '../../common/dto/create-campaign.dto';

@ApiTags('campaigns')
@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List campaigns' })
  @ApiOkResponse({ type: [CampaignResponseDto] })
  async findAll(@Req() req: any) {
    return this.campaignsService.findAll(req.user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get a campaign by ID' })
  @ApiOkResponse({ type: CampaignResponseDto })
  async findOne(@Param('id') id: string) {
    return this.campaignsService.findById(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Create a campaign (Admin or Manager)' })
  @ApiOkResponse({ type: CampaignResponseDto })
  async create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Update a campaign (Admin or Manager)' })
  @ApiOkResponse({ type: CampaignResponseDto })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateCampaignDto>) {
    return this.campaignsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Delete a campaign' })
  async delete(@Param('id') id: string) {
    return this.campaignsService.delete(id);
  }

  @Post(':id/users')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Assign users to campaign (sends email notifications to newly assigned users)' })
  @ApiOkResponse({ type: CampaignResponseDto })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userIds: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async assignUsers(@Param('id') id: string, @Body() body: { userIds: string[] }, @Req() req: any) {
    return this.campaignsService.assignUsers(id, body.userIds, req.user.userId);
  }
}
