import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventTypesController } from './event-types.controller';
import { EventTypesService } from './event-types.service';
import { EventType } from './event-type.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventType]),
    forwardRef(() => UsersModule),
  ],
  controllers: [EventTypesController],
  providers: [EventTypesService],
  exports: [EventTypesService],
})
export class EventTypesModule {}
