import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveService } from './leave.service';
import { LeaveType } from './leave-type.entity';
import { LeaveRequest } from './leave-request.entity';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { UsersModule } from '../users/users.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveType, LeaveRequest, User, Campaign]), UsersModule, CampaignsModule],
  controllers: [LeaveRequestsController, LeaveTypesController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
