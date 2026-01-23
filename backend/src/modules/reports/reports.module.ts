import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { TimeEvent } from '../time-events/time-event.entity';
import { LeaveRequest } from '../leave/leave-request.entity';
import { UsersModule } from '../users/users.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { TimeEventsModule } from '../time-events/time-events.module';
import { LeaveModule } from '../leave/leave.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Campaign, TimeEvent, LeaveRequest]),
    UsersModule,
    CampaignsModule,
    TimeEventsModule,
    LeaveModule
  ],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
