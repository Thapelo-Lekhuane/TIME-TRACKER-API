import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEventsController } from './time-events.controller';
import { TimeEventsService } from './time-events.service';
import { TimeEvent } from './time-event.entity';
import { User } from '../users/user.entity';
import { EventType } from '../event-types/event-type.entity';
import { EventTypesModule } from '../event-types/event-types.module';

@Module({
  imports: [TypeOrmModule.forFeature([TimeEvent, User, EventType]), EventTypesModule],
  controllers: [TimeEventsController],
  providers: [TimeEventsService],
  exports: [TimeEventsService],
})
export class TimeEventsModule {}
