import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TimeEventsController } from './time-events.controller';
import { TimeEventsService } from './time-events.service';
import { LateMonitoringService } from './late-monitoring.service';
import { TimeEvent } from './time-event.entity';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { EventType } from '../event-types/event-type.entity';
import { EventTypesModule } from '../event-types/event-types.module';
import { EmailModule } from '../../common/services/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeEvent, User, Campaign, EventType]),
    ScheduleModule.forRoot(),
    EventTypesModule,
    EmailModule,
  ],
  controllers: [TimeEventsController],
  providers: [TimeEventsService, LateMonitoringService],
  exports: [TimeEventsService],
})
export class TimeEventsModule {}
