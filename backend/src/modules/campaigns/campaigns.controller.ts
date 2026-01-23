import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
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

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a campaign' })
  @ApiOkResponse({ type: CampaignResponseDto })
  async create(@Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a campaign' })
  @ApiOkResponse({ type: CampaignResponseDto })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateCampaignDto>) {
    return this.campaignsService.update(id, dto);
  }

  @Post(':id/users')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Assign users to campaign' })
  @ApiOkResponse({ type: CampaignResponseDto })
  async assignUsers(@Param('id') id: string, @Body() body: { userIds: string[] }) {
    return this.campaignsService.assignUsers(id, body.userIds);
  }
}
