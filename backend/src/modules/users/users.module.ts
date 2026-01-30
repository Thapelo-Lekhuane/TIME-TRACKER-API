import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MeController } from './me.controller';
import { TimeEventsModule } from '../time-events/time-events.module';
import { EmailModule } from '../../common/services/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Campaign]), TimeEventsModule, EmailModule],
  providers: [UsersService],
  controllers: [UsersController, MeController],
  exports: [UsersService],
})
export class UsersModule {}
