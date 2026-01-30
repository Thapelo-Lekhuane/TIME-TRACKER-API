import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Campaign } from './campaign.entity';
import { User } from '../users/user.entity';
import { Role } from '../../common/enums/role.enum';
import { EmailService } from '../../common/services/email.service';
import { EventTypesService } from '../event-types/event-types.service';
import { EventCategory } from '../../common/enums/event-category.enum';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly repo: Repository<Campaign>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
    private readonly eventTypesService: EventTypesService,
  ) {}

  /** Map campaign entity to plain object to avoid circular JSON and sensitive user fields */
  private toCampaignResponse(c: Campaign) {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      timeZone: c.timeZone ?? c.defaultTimeZone,
      defaultTimeZone: c.defaultTimeZone ?? c.timeZone,
      workDayStart: c.workDayStart,
      workDayEnd: c.workDayEnd,
      lunchStart: c.lunchStart,
      lunchEnd: c.lunchEnd,
      teaBreaks: c.teaBreaks,
      leaveApproverEmail: c.leaveApproverEmail,
      users: (c.users || []).map((u) => ({ id: u.id, fullName: u.fullName, email: u.email })),
      teamLeaders: (c.teamLeaders || []).map((t) => ({ id: t.id, fullName: t.fullName, email: t.email })),
    };
  }

  async findAll(user: any) {
    let list: Campaign[];
    if (user.role === Role.ADMIN) {
      list = await this.repo
        .createQueryBuilder('campaign')
        .leftJoinAndSelect('campaign.users', 'users')
        .leftJoin('campaign.teamLeaders', 'teamLeaders')
        .addSelect(['teamLeaders.id', 'teamLeaders.fullName', 'teamLeaders.email'])
        .getMany();
    } else {
      list = await this.repo
        .createQueryBuilder('campaign')
        .leftJoinAndSelect('campaign.users', 'users')
        .leftJoin('campaign.teamLeaders', 'teamLeaders')
        .addSelect(['teamLeaders.id', 'teamLeaders.fullName', 'teamLeaders.email'])
        .getMany();
    }
    return list.map((c) => this.toCampaignResponse(c));
  }

  async findById(id: string) {
    const campaign = await this.repo
      .createQueryBuilder('campaign')
      .leftJoinAndSelect('campaign.users', 'users')
      .leftJoin('campaign.teamLeaders', 'teamLeaders')
      .addSelect(['teamLeaders.id', 'teamLeaders.fullName', 'teamLeaders.email'])
      .where('campaign.id = :id', { id })
      .getOne();
    if (!campaign) throw new NotFoundException('Campaign not found');
    return this.toCampaignResponse(campaign);
  }

  async create(dto: {
    name: string;
    description?: string;
    defaultTimeZone?: string;
    timeZone?: string;
    workDayStart?: string;
    workDayEnd?: string;
    lunchStart?: string;
    lunchEnd?: string;
    teaBreaks?: any[];
    leaveApproverEmail?: string;
  }) {
    const campaign = this.repo.create({
      name: dto.name,
      description: dto.description,
      timeZone: dto.timeZone || dto.defaultTimeZone || 'Africa/Johannesburg',
      defaultTimeZone: dto.defaultTimeZone || dto.timeZone || 'Africa/Johannesburg',
      workDayStart: dto.workDayStart,
      workDayEnd: dto.workDayEnd,
      lunchStart: dto.lunchStart,
      lunchEnd: dto.lunchEnd,
      teaBreaks: dto.teaBreaks,
      leaveApproverEmail: dto.leaveApproverEmail,
    });
    const savedCampaign = await this.repo.save(campaign);

    // Create campaign-specific event types for breaks
    await this.createCampaignEventTypes(savedCampaign.id, savedCampaign.name, {
      lunchStart: dto.lunchStart,
      lunchEnd: dto.lunchEnd,
      teaBreaks: dto.teaBreaks,
    });

    return savedCampaign;
  }

  private async createCampaignEventTypes(campaignId: string, campaignName: string, breaks: {
    lunchStart?: string;
    lunchEnd?: string;
    teaBreaks?: any[];
  }) {
    try {
      // Sanitize campaign name for use in event type names (remove special chars, limit length)
      const safeCampaignName = campaignName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20) || 'Campaign';
      
      // Create lunch break event types if lunch times are provided
      if (breaks.lunchStart && breaks.lunchEnd) {
        const lunchStartName = `${safeCampaignName} - Lunch Start`;
        const lunchEndName = `${safeCampaignName} - Lunch End`;
        
        // Check if they already exist
        const existingEvents = await this.eventTypesService.findAll();
        const lunchStartExists = existingEvents.some(et => 
          et.campaignId === campaignId && et.name === lunchStartName
        );
        const lunchEndExists = existingEvents.some(et => 
          et.campaignId === campaignId && et.name === lunchEndName
        );

        if (!lunchStartExists) {
          await this.eventTypesService.create({
            name: lunchStartName,
            category: EventCategory.BREAK,
            isPaid: false,
            isBreak: true,
            isGlobal: false,
            campaignId: campaignId,
          });
          this.logger.log(`Created lunch start event type for campaign ${campaignName}`);
        }

        if (!lunchEndExists) {
          await this.eventTypesService.create({
            name: lunchEndName,
            category: EventCategory.BREAK,
            isPaid: false,
            isBreak: true,
            isGlobal: false,
            campaignId: campaignId,
          });
          this.logger.log(`Created lunch end event type for campaign ${campaignName}`);
        }
      }

      // Create tea break event types if tea breaks are provided
      if (breaks.teaBreaks && Array.isArray(breaks.teaBreaks) && breaks.teaBreaks.length > 0) {
        const existingEvents = await this.eventTypesService.findAll();
        
        for (let i = 0; i < breaks.teaBreaks.length; i++) {
          const teaBreak = breaks.teaBreaks[i];
          if (teaBreak.start && teaBreak.end) {
            const teaStartName = `${safeCampaignName} - Tea Break ${i + 1} Start`;
            const teaEndName = `${safeCampaignName} - Tea Break ${i + 1} End`;

            const teaStartExists = existingEvents.some(et => 
              et.campaignId === campaignId && et.name === teaStartName
            );
            const teaEndExists = existingEvents.some(et => 
              et.campaignId === campaignId && et.name === teaEndName
            );

            if (!teaStartExists) {
              await this.eventTypesService.create({
                name: teaStartName,
                category: EventCategory.BREAK,
                isPaid: false,
                isBreak: true,
                isGlobal: false,
                campaignId: campaignId,
              });
              this.logger.log(`Created tea break ${i + 1} start event type for campaign ${campaignName}`);
            }

            if (!teaEndExists) {
              await this.eventTypesService.create({
                name: teaEndName,
                category: EventCategory.BREAK,
                isPaid: false,
                isBreak: true,
                isGlobal: false,
                campaignId: campaignId,
              });
              this.logger.log(`Created tea break ${i + 1} end event type for campaign ${campaignName}`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to create event types for campaign ${campaignId}:`, error);
      // Don't throw - campaign creation should succeed even if event type creation fails
    }
  }

  async update(id: string, dto: any) {
    const campaign = await this.repo.findOne({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    // Keep time zone fields consistent if either is updated.
    if (dto.timeZone && !dto.defaultTimeZone) dto.defaultTimeZone = dto.timeZone;
    if (dto.defaultTimeZone && !dto.timeZone) dto.timeZone = dto.defaultTimeZone;
    Object.assign(campaign, dto);
    const savedCampaign = await this.repo.save(campaign);

    // Create/update event types if schedule fields are provided
    if (dto.lunchStart || dto.lunchEnd || dto.teaBreaks) {
      await this.createCampaignEventTypes(savedCampaign.id, savedCampaign.name, {
        lunchStart: dto.lunchStart !== undefined ? dto.lunchStart : savedCampaign.lunchStart,
        lunchEnd: dto.lunchEnd !== undefined ? dto.lunchEnd : savedCampaign.lunchEnd,
        teaBreaks: dto.teaBreaks !== undefined ? dto.teaBreaks : savedCampaign.teaBreaks,
      });
    }

    return savedCampaign;
  }

  async delete(id: string) {
    const campaign = await this.repo.findOne({ where: { id }, relations: ['users'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    
    // Unassign all users from this campaign before deleting
    if (campaign.users?.length) {
      for (const user of campaign.users) {
        user.campaign = null as any;
      }
      await this.userRepo.save(campaign.users);
    }
    
    await this.repo.remove(campaign);
    return { message: 'Campaign deleted successfully' };
  }

  async assignUsers(campaignId: string, userIds: string[], assignedByUserId?: string) {
    const campaign = await this.repo.findOne({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const desiredIds = Array.from(new Set((userIds ?? []).filter(Boolean)));

    // Fetch current users assigned to this campaign (owning side is User.campaign).
    const currentlyAssigned = await this.userRepo.find({
      where: { campaign: { id: campaignId } },
      relations: ['campaign'],
    });
    const currentlyAssignedIds = new Set(currentlyAssigned.map(u => u.id));

    // Assign campaign to desired users
    const desiredUsers = desiredIds.length
      ? await this.userRepo.find({ where: { id: In(desiredIds) }, relations: ['campaign'] })
      : [];

    // Identify newly assigned users (not previously in this campaign)
    const newlyAssignedUsers = desiredUsers.filter(u => !currentlyAssignedIds.has(u.id));

    for (const u of desiredUsers) {
      u.campaign = campaign;
    }

    // Remove campaign from users no longer in desired list
    const desiredSet = new Set(desiredIds);
    const toUnassign = currentlyAssigned.filter((u) => !desiredSet.has(u.id));
    for (const u of toUnassign) {
      u.campaign = null as any;
    }

    if (desiredUsers.length) await this.userRepo.save(desiredUsers);
    if (toUnassign.length) await this.userRepo.save(toUnassign);

    // Send email notifications to newly assigned users
    if (newlyAssignedUsers.length > 0) {
      let assignedByName = 'System Administrator';
      if (assignedByUserId) {
        const assigner = await this.userRepo.findOne({ where: { id: assignedByUserId } });
        if (assigner) {
          assignedByName = assigner.fullName;
        }
      }

      // Reload campaign to ensure we have the latest schedule data
      const campaignWithSchedule = await this.repo.findOne({
        where: { id: campaignId },
      });
      
      if (!campaignWithSchedule) {
        this.logger.error(`Campaign ${campaignId} not found when sending assignment emails`);
        return this.repo.findOne({ where: { id: campaignId }, relations: ['users'] });
      }

      // Find managers and team leads in the campaign (after users have been assigned)
      const campaignUsers = await this.userRepo.find({
        where: { campaign: { id: campaignId } },
      });
      
      const managers = campaignUsers.filter(u => u.role === Role.MANAGER);
      const teamLeads = campaignUsers.filter(u => 
        u.role === Role.MANAGER || 
        u.designation?.toLowerCase().includes('team lead') || 
        u.designation?.toLowerCase().includes('team leader')
      );
      
      // Get the first manager as the primary manager
      const manager = managers.length > 0 ? managers[0] : null;
      // Get the first team lead (or manager if no specific team lead)
      const teamLead = teamLeads.length > 0 ? teamLeads[0] : manager;

      // Fetch event types for this campaign (global + campaign-specific)
      const eventTypes = await this.eventTypesService.findForUser(campaignId);
      const eventTypesForEmail = eventTypes
        .filter(et => et.active)
        .map(et => ({
          name: et.name,
          category: et.category,
          isBreak: et.isBreak,
        }));

      for (const newUser of newlyAssignedUsers) {
        this.emailService.sendCampaignAssignmentNotification({
          toEmail: newUser.email,
          employeeName: newUser.fullName,
          campaignName: campaignWithSchedule.name,
          campaignDescription: campaignWithSchedule.description,
          assignedByName,
          workDayStart: campaignWithSchedule.workDayStart,
          workDayEnd: campaignWithSchedule.workDayEnd,
          lunchStart: campaignWithSchedule.lunchStart,
          lunchEnd: campaignWithSchedule.lunchEnd,
          teaBreaks: campaignWithSchedule.teaBreaks as Array<{ start: string; end: string }> | undefined,
          teamLeadName: teamLead?.fullName,
          teamLeadEmail: teamLead?.email,
          managerName: manager?.fullName,
          managerEmail: manager?.email,
          eventTypes: eventTypesForEmail,
        }).catch(err => {
          this.logger.error(`Failed to send campaign assignment email to ${newUser.email}`, err);
        });
      }
    }

    // Return updated campaign with users relation
    return this.repo.findOne({ where: { id: campaignId }, relations: ['users'] });
  }
}
