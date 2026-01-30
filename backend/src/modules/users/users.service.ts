import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { hash } from 'bcrypt';
import { User } from './user.entity';
import { Role } from '../../common/enums/role.enum';
import { Campaign } from '../campaigns/campaign.entity';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    private readonly emailService: EmailService,
  ) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  /** Map user entity to plain object (no passwordHash, no circular refs) */
  private toUserResponse(u: User) {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      designation: u.designation,
      role: u.role,
      status: u.status,
      timeZone: u.timeZone,
      campaignId: u.campaign?.id ?? null,
      campaign: u.campaign ? {
        id: u.campaign.id,
        name: u.campaign.name,
        workDayStart: u.campaign.workDayStart,
        workDayEnd: u.campaign.workDayEnd,
        lunchStart: u.campaign.lunchStart,
        lunchEnd: u.campaign.lunchEnd,
        teaBreaks: u.campaign.teaBreaks,
      } : null,
      teamLeaderId: u.teamLeaderId ?? u.teamLeader?.id ?? null,
      teamLeader: u.teamLeader ? { id: u.teamLeader.id, fullName: u.teamLeader.fullName, email: u.teamLeader.email } : null,
    };
  }

  async findById(id: string) {
    const user = await this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.campaign', 'campaign')
      .leftJoinAndSelect('user.teamLeader', 'teamLeader')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('User not found');
    return this.toUserResponse(user);
  }

  async findAll() {
    const list = await this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.campaign', 'campaign')
      .leftJoinAndSelect('user.teamLeader', 'teamLeader')
      .getMany();
    return list.map((u) => this.toUserResponse(u));
  }

  async findAvailable() {
    const list = await this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.campaign', 'campaign')
      .leftJoinAndSelect('user.teamLeader', 'teamLeader')
      .where('user.campaignId IS NULL')
      .getMany();
    return list.map((u) => this.toUserResponse(u));
  }

  async create(dto: {
    email: string;
    password: string;
    fullName: string;
    designation?: string;
    campaignId?: string;
    timeZone?: string;
  }) {
    const passwordHash = await hash(dto.password, 10);
    const user = this.repo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      fullName: dto.fullName,
      designation: dto.designation,
      role: Role.EMPLOYEE,
      timeZone: dto.timeZone || 'Africa/Johannesburg',
      campaign: dto.campaignId ? { id: dto.campaignId } : undefined,
    });
    return this.repo.save(user);
  }

  async updateRole(id: string, role: Role) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    const saved = await this.repo.save(user);
    return this.toUserResponse(await this.repo.findOne({
      where: { id: saved.id },
      relations: ['campaign', 'teamLeader'],
    }) as User);
  }

  async updateUser(id: string, dto: {
    fullName?: string;
    designation?: string;
    role?: Role;
    campaignId?: string | null;
    timeZone?: string;
    status?: string;
    teamLeaderId?: string | null;
  }, updatedByUserId?: string) {
    const user = await this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.campaign', 'campaign')
      .leftJoinAndSelect('user.teamLeader', 'teamLeader')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('User not found');
    
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.designation !== undefined) user.designation = dto.designation;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.timeZone !== undefined) user.timeZone = dto.timeZone;
    if (dto.status !== undefined) user.status = dto.status;
    
    // Handle campaign assignment
    if (dto.campaignId === null) {
      user.campaign = null as any;
    } else if (dto.campaignId !== undefined) {
      user.campaign = { id: dto.campaignId } as Campaign;
    }
    
    // Handle team leader assignment
    const previousTeamLeaderId = user.teamLeaderId;
    if (dto.teamLeaderId === null) {
      user.teamLeader = null as any;
      user.teamLeaderId = null;
    } else if (dto.teamLeaderId !== undefined) {
      const teamLeader = await this.repo.findOne({ where: { id: dto.teamLeaderId } });
      if (!teamLeader) throw new NotFoundException('Team leader not found');
      user.teamLeader = teamLeader;
      user.teamLeaderId = dto.teamLeaderId;
      
      // Send emails if this is a new assignment (not an update to the same leader)
      if (previousTeamLeaderId !== dto.teamLeaderId) {
        // Get the user who made this change
        let assignedByName = 'System Administrator';
        if (updatedByUserId) {
          const assigner = await this.repo.findOne({ where: { id: updatedByUserId } });
          if (assigner) {
            assignedByName = assigner.fullName;
          }
        }
        
        // Get campaign info if user is assigned to one
        const userWithCampaign = await this.repo.findOne({
          where: { id: user.id },
          relations: ['campaign'],
        });
        
        // Check if team leader is becoming a team leader for the first time
        // (i.e., they don't currently have any team members besides the one being assigned)
        const existingTeamMembers = await this.repo.find({
          where: { teamLeaderId: teamLeader.id },
        });
        // Filter out the current user being assigned (if they were already assigned)
        const otherTeamMembers = existingTeamMembers.filter(m => m.id !== user.id);
        const isFirstTimeTeamLeader = otherTeamMembers.length === 0;
        
        // Get team leader's campaign info
        const teamLeaderWithCampaign = await this.repo.findOne({
          where: { id: teamLeader.id },
          relations: ['campaign'],
        });
        
        const campaignName = teamLeaderWithCampaign?.campaign?.name || userWithCampaign?.campaign?.name;
        
        // Send emails (don't await to avoid blocking, but log results)
        // Send email to employee: "You've been assigned to team leader X"
        this.emailService.sendTeamMemberAssignmentNotification({
          toEmail: user.email,
          employeeName: user.fullName,
          teamLeaderName: teamLeader.fullName,
          teamLeaderEmail: teamLeader.email,
          campaignName: campaignName,
          assignedByName,
        }).then(sent => {
          if (sent) {
            this.logger.log(`✓ Team member assignment email sent to ${user.email}`);
          } else {
            this.logger.warn(`✗ Failed to send team member assignment email to ${user.email}`);
          }
        }).catch(err => {
          this.logger.error(`Failed to send team member assignment email to ${user.email}`, err);
        });
        
        // If this is the first time this person is becoming a team leader, send promotion email
        if (isFirstTimeTeamLeader) {
          this.emailService.sendTeamLeaderPromotionNotification({
            toEmail: teamLeader.email,
            employeeName: teamLeader.fullName,
            campaignName: campaignName,
            campaignDescription: teamLeaderWithCampaign?.campaign?.description,
            promotedByName: assignedByName,
          }).then(sent => {
            if (sent) {
              this.logger.log(`✓ Team leader promotion email sent to ${teamLeader.email}`);
            } else {
              this.logger.warn(`✗ Failed to send team leader promotion email to ${teamLeader.email}`);
            }
          }).catch(err => {
            this.logger.error(`Failed to send team leader promotion email to ${teamLeader.email}`, err);
          });
        }
        
        // Send email to team leader: "You've been assigned employee Y"
        this.emailService.sendTeamLeaderAssignmentNotification({
          toEmail: teamLeader.email,
          teamLeaderName: teamLeader.fullName,
          employeeNames: [user.fullName],
          campaignName: campaignName,
          assignedByName,
        }).then(sent => {
          if (sent) {
            this.logger.log(`✓ Team leader assignment email sent to ${teamLeader.email}`);
          } else {
            this.logger.warn(`✗ Failed to send team leader assignment email to ${teamLeader.email}`);
          }
        }).catch(err => {
          this.logger.error(`Failed to send team leader assignment email to ${teamLeader.email}`, err);
        });
      }
    }
    
    const saved = await this.repo.save(user);
    return this.toUserResponse(await this.repo.findOne({
      where: { id: saved.id },
      relations: ['campaign', 'teamLeader'],
    }) as User);
  }

  async assignTeamLeaderToCampaign(campaignId: string, teamLeaderId: string, assignedByUserId?: string) {
    // Get campaign
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Get team leader
    const teamLeader = await this.repo.findOne({ where: { id: teamLeaderId } });
    if (!teamLeader) {
      throw new NotFoundException('Team leader not found');
    }

    // Get all employees in the campaign (excluding managers)
    const employees = await this.repo.find({
      where: { 
        campaign: { id: campaignId },
        role: Role.EMPLOYEE,
      },
      relations: ['campaign'],
    });

    if (employees.length === 0) {
      return {
        success: true,
        message: 'No employees found in this campaign',
        assignedCount: 0,
      };
    }

    // Get the user who made this change
    let assignedByName = 'System Administrator';
    if (assignedByUserId) {
      const assigner = await this.repo.findOne({ where: { id: assignedByUserId } });
      if (assigner) {
        assignedByName = assigner.fullName;
      }
    }

    // Check if team leader is becoming a team leader for the first time
    const existingTeamMembers = await this.repo.find({
      where: { teamLeaderId: teamLeader.id },
    });
    const isFirstTimeTeamLeader = existingTeamMembers.length === 0;

    // Assign all employees to the team leader
    const employeeNames: string[] = [];
    for (const employee of employees) {
      employee.teamLeader = teamLeader;
      employee.teamLeaderId = teamLeader.id;
      employeeNames.push(employee.fullName);
    }

    await this.repo.save(employees);

    // Send ONE email to team leader with ALL team members
    const teamLeaderWithCampaign = await this.repo.findOne({
      where: { id: teamLeader.id },
      relations: ['campaign'],
    });

    const campaignName = campaign.name;

    // If this is the first time this person is becoming a team leader, send promotion email
    if (isFirstTimeTeamLeader) {
      this.emailService.sendTeamLeaderPromotionNotification({
        toEmail: teamLeader.email,
        employeeName: teamLeader.fullName,
        campaignName: campaignName,
        campaignDescription: campaign.description,
        promotedByName: assignedByName,
      }).then(sent => {
        if (sent) {
          this.logger.log(`✓ Team leader promotion email sent to ${teamLeader.email}`);
        } else {
          this.logger.warn(`✗ Failed to send team leader promotion email to ${teamLeader.email}`);
        }
      }).catch(err => {
        this.logger.error(`Failed to send team leader promotion email to ${teamLeader.email}`, err);
      });
    }

    // Send ONE email to team leader with all team members
    this.emailService.sendTeamLeaderAssignmentNotification({
      toEmail: teamLeader.email,
      teamLeaderName: teamLeader.fullName,
      employeeNames: employeeNames,
      campaignName: campaignName,
      assignedByName,
    }).then(sent => {
      if (sent) {
        this.logger.log(`✓ Team leader assignment email sent to ${teamLeader.email} with ${employeeNames.length} team members`);
      } else {
        this.logger.warn(`✗ Failed to send team leader assignment email to ${teamLeader.email}`);
      }
    }).catch(err => {
      this.logger.error(`Failed to send team leader assignment email to ${teamLeader.email}`, err);
    });

    // Send individual emails to each team member
    for (const employee of employees) {
      this.emailService.sendTeamMemberAssignmentNotification({
        toEmail: employee.email,
        employeeName: employee.fullName,
        teamLeaderName: teamLeader.fullName,
        teamLeaderEmail: teamLeader.email,
        campaignName: campaignName,
        assignedByName,
      }).then(sent => {
        if (sent) {
          this.logger.log(`✓ Team member assignment email sent to ${employee.email}`);
        } else {
          this.logger.warn(`✗ Failed to send team member assignment email to ${employee.email}`);
        }
      }).catch(err => {
        this.logger.error(`Failed to send team member assignment email to ${employee.email}`, err);
      });
    }

    return {
      success: true,
      message: `Successfully assigned ${employees.length} employee(s) to ${teamLeader.fullName} as team leader`,
      assignedCount: employees.length,
      teamLeaderName: teamLeader.fullName,
      employeeNames,
    };
  }

  async createAdmin(email: string, password: string, timeZone: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      // Ensure existing user is promoted to ADMIN (bootstrap must be idempotent).
      const passwordHash = await hash(password, 10);
      existing.passwordHash = passwordHash;
      existing.timeZone = timeZone;
      existing.role = Role.ADMIN;
      if (!existing.fullName) existing.fullName = 'System Admin';
      return this.repo.save(existing);
    }

    const passwordHash = await hash(password, 10);
    const admin = this.repo.create({
      email: email.toLowerCase(),
      passwordHash,
      fullName: 'System Admin',
      role: Role.ADMIN,
      timeZone,
    });
    return this.repo.save(admin);
  }
}
