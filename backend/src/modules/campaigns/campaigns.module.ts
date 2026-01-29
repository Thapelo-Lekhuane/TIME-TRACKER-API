import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { Campaign } from './campaign.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { EventTypesModule } from '../event-types/event-types.module';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, User]), UsersModule, EventTypesModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
