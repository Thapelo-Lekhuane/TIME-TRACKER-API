import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MeController } from './me.controller';
import { TimeEventsModule } from '../time-events/time-events.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), TimeEventsModule],
  providers: [UsersService],
  controllers: [UsersController, MeController],
  exports: [UsersService],
})
export class UsersModule {}
