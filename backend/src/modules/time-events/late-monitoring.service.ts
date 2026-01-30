import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { User } from '../users/user.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { TimeEvent } from './time-event.entity';
import { EventType } from '../event-types/event-type.entity';
import { EmailService } from '../../common/services/email.service';
import { SettingsService } from '../settings/settings.service';
import { Role } from '../../common/enums/role.enum';

interface LateNotification {
  userId: string;
  userEmail: string;
  userName: string;
  campaignId: string;
  campaignName: string;
  lateMinutes: number;
  notified15Min: boolean;
  notified30Min: boolean;
}

@Injectable()
export class LateMonitoringService {
  private readonly logger = new Logger(LateMonitoringService.name);
  private lateNotifications: Map<string, LateNotification> = new Map();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(TimeEvent)
    private readonly timeEventRepo: Repository<TimeEvent>,
    @InjectRepository(EventType)
    private readonly eventTypeRepo: Repository<EventType>,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
  ) {}

  // Run every minute to check for late arrivals
  @Cron(CronExpression.EVERY_MINUTE)
  async checkLateArrivals() {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Get all campaigns with work start times
      const campaigns = await this.campaignRepo
        .createQueryBuilder('campaign')
        .leftJoinAndSelect('campaign.users', 'users')
        .leftJoinAndSelect('campaign.teamLeaders', 'teamLeaders')
        .where('campaign.workDayStart IS NOT NULL')
        .getMany();

      // Get work start event type
      const workStartEventType = await this.eventTypeRepo
        .createQueryBuilder('eventType')
        .where("eventType.name LIKE '%Work Start%'")
        .getOne();

      if (!workStartEventType) {
        return; // No work start event type found
      }

      for (const campaign of campaigns) {
        if (!campaign.workDayStart) continue;

        const [hours, minutes] = campaign.workDayStart.split(':').map(Number);
        const workStartTime = new Date(now);
        workStartTime.setHours(hours, minutes, 0, 0);

        // Check employees in this campaign
        for (const user of campaign.users || []) {
          if (user.role !== Role.EMPLOYEE) continue;

          // Check if user has clocked in today
          const startOfDay = new Date(today + 'T00:00:00Z');
          const endOfDay = new Date(today + 'T23:59:59Z');
          
          const clockInEvent = await this.timeEventRepo.findOne({
            where: {
              user: { id: user.id },
              eventType: { id: workStartEventType.id },
              timestampUtc: Between(startOfDay, endOfDay),
            },
          });

          // If user hasn't clocked in and work start time has passed
          if (!clockInEvent && now > workStartTime) {
            const lateMs = now.getTime() - workStartTime.getTime();
            const lateMinutes = Math.floor(lateMs / (1000 * 60));

            const key = `${user.id}-${today}`;
            let notification = this.lateNotifications.get(key);

            if (!notification) {
              notification = {
                userId: user.id,
                userEmail: user.email,
                userName: user.fullName,
                campaignId: campaign.id,
                campaignName: campaign.name,
                lateMinutes,
                notified15Min: false,
                notified30Min: false,
              };
              this.lateNotifications.set(key, notification);
            } else {
              notification.lateMinutes = lateMinutes;
            }

            // Send notification at 15 minutes
            if (lateMinutes >= 15 && !notification.notified15Min) {
              await this.notifyTeamLeaders(notification, campaign);
              notification.notified15Min = true;
            }

            // Escalate to manager at 30 minutes
            if (lateMinutes >= 30 && !notification.notified30Min) {
              await this.escalateToManager(notification, campaign);
              notification.notified30Min = true;
            }
          } else if (clockInEvent) {
            // User has clocked in, remove from monitoring
            const key = `${user.id}-${today}`;
            this.lateNotifications.delete(key);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error checking late arrivals', error);
    }
  }

  private async notifyTeamLeaders(notification: LateNotification, campaign: Campaign) {
    try {
      const teamLeaders = campaign.teamLeaders || [];
      
      if (teamLeaders.length === 0) {
        // Fallback: find team leaders from users assigned to this campaign
        const users = await this.userRepo.find({
          where: { campaign: { id: campaign.id } },
          relations: ['teamLeader'],
        });
        
        const teamLeaderIds = new Set(
          users
            .map(u => u.teamLeader?.id)
            .filter(id => id !== null && id !== undefined)
        );

        for (const teamLeaderId of teamLeaderIds) {
          const teamLeader = await this.userRepo.findOne({
            where: { id: teamLeaderId },
          });
          if (teamLeader) {
            await this.emailService.sendLateArrivalNotification({
              toEmail: teamLeader.email,
              employeeName: notification.userName,
              employeeEmail: notification.userEmail,
              campaignName: notification.campaignName,
              lateMinutes: notification.lateMinutes,
              isEscalation: false,
            });
          }
        }
      } else {
        for (const teamLeader of teamLeaders) {
          await this.emailService.sendLateArrivalNotification({
            toEmail: teamLeader.email,
            employeeName: notification.userName,
            employeeEmail: notification.userEmail,
            campaignName: notification.campaignName,
            lateMinutes: notification.lateMinutes,
            isEscalation: false,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error notifying team leaders', error);
    }
  }

  private async escalateToManager(notification: LateNotification, campaign: Campaign) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Send entire escalation (escalator + managers + admins) only once per user per day (persisted across restarts)
      const alreadySent = await this.settingsService.wasEscalationSentToEscalator(notification.userId, today);
      if (alreadySent) {
        return; // Already sent for this user today — do not send to anyone
      }

      const escalationPayload = {
        employeeName: notification.userName,
        employeeEmail: notification.userEmail,
        campaignName: notification.campaignName,
        lateMinutes: notification.lateMinutes,
        isEscalation: true,
      };

      const escalatedLateEmail = await this.settingsService.getEscalatedLateEmail();
      if (escalatedLateEmail && escalatedLateEmail.trim()) {
        await this.emailService.sendLateArrivalNotification({
          ...escalationPayload,
          toEmail: escalatedLateEmail.trim(),
        });
        this.logger.log(`Escalation sent once to configured email: ${escalatedLateEmail}`);
      }

      const managers = await this.userRepo.find({
        where: {
          campaign: { id: campaign.id },
          role: Role.MANAGER,
        },
      });

      const admins = await this.userRepo.find({
        where: { role: Role.ADMIN },
      });

      const escalatedLower = escalatedLateEmail?.trim().toLowerCase() ?? '';
      for (const recipient of [...managers, ...admins]) {
        if (recipient.email.toLowerCase() !== escalatedLower) {
          await this.emailService.sendLateArrivalNotification({
            toEmail: recipient.email,
            ...escalationPayload,
          });
        }
      }

      await this.settingsService.markEscalationSentToEscalator(notification.userId, today);
    } catch (error) {
      this.logger.error('Error escalating to manager', error);
    }
  }
}
