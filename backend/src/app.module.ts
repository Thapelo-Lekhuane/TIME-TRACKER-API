import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getTypeOrmConfig } from './config/database.config';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { EventTypesModule } from './modules/event-types/event-types.module';
import { TimeEventsModule } from './modules/time-events/time-events.module';
import { LeaveModule } from './modules/leave/leave.module';
import { TimesheetsModule } from './modules/timesheets/timesheets.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: getTypeOrmConfig,
    }),
    AuthModule,
    UsersModule,
    CampaignsModule,
    EventTypesModule,
    TimeEventsModule,
    LeaveModule,
    TimesheetsModule,
    ReportsModule,
  ],
})
export class AppModule {}
