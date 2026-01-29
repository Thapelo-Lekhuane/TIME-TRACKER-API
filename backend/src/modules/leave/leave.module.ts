import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveBalanceController } from './leave-balance.controller';
import { LeaveService } from './leave.service';
import { LeaveType } from './leave-type.entity';
import { LeaveRequest } from './leave-request.entity';
import { LeaveBalance } from './leave-balance.entity';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { UsersModule } from '../users/users.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [TypeOrmModule.forFeature([LeaveType, LeaveRequest, LeaveBalance, User, Campaign]), UsersModule, CampaignsModule],
  controllers: [LeaveRequestsController, LeaveTypesController, LeaveBalanceController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
