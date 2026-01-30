import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface LeaveRequestEmailData {
  toEmail: string;
  campaignName: string;
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason?: string;
  leaveRequestId?: string;
  baseUrl?: string;
}

export interface LeaveRequestConfirmationEmailData {
  toEmail: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  campaignName: string;
}

export interface CampaignAssignmentEmailData {
  toEmail: string;
  employeeName: string;
  campaignName: string;
  campaignDescription?: string;
  assignedByName: string;
  workDayStart?: string;
  workDayEnd?: string;
  lunchStart?: string;
  lunchEnd?: string;
  teaBreaks?: Array<{ start: string; end: string }>;
  teamLeadName?: string;
  teamLeadEmail?: string;
  managerName?: string;
  managerEmail?: string;
  eventTypes?: Array<{ name: string; category: string; isBreak: boolean }>;
}

export interface LateArrivalEmailData {
  toEmail: string;
  employeeName: string;
  employeeEmail: string;
  campaignName: string;
  lateMinutes: number;
  isEscalation: boolean;
}

export interface TeamLeaderPromotionEmailData {
  toEmail: string;
  employeeName: string;
  teamLeaderName?: string;
  teamLeaderEmail?: string;
  campaignName?: string;
  campaignDescription?: string;
  promotedByName: string;
  responsibilities?: string[];
}

export interface TeamMemberAssignmentEmailData {
  toEmail: string;
  employeeName: string;
  teamLeaderName: string;
  teamLeaderEmail: string;
  campaignName?: string;
  assignedByName: string;
}

export interface TeamLeaderAssignmentEmailData {
  toEmail: string;
  teamLeaderName: string;
  employeeNames: string[];
  campaignName?: string;
  assignedByName: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  /** Shared email wrapper: header + content + footer */
  private emailWrapper(title: string, content: string, accentColor = '#2563eb'): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
    <div style="background: linear-gradient(135deg, ${accentColor} 0%, #1d4ed8 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 600;">TimeTrack</h1>
      <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">${title}</p>
    </div>
    <div style="background: #ffffff; padding: 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      ${content}
    </div>
    <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
      This is an automated message from TimeTrack Workforce Attendance System.
    </div>
  </div>
</body>
</html>`;
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
        // For Gmail and other providers using port 587, require TLS
        ...(port === 587 && {
          requireTLS: true,
          tls: {
            rejectUnauthorized: false, // Allow self-signed certificates if needed
          },
        }),
      });
      this.logger.log(`Email transporter initialized successfully (${host}:${port})`);
    } else {
      this.logger.warn('SMTP configuration not found. Email notifications will be logged only.');
    }
  }

  async sendLeaveRequestNotification(data: LeaveRequestEmailData): Promise<boolean> {
    const subject = `Leave Request: ${data.employeeName} - ${data.leaveType}`;
    
    // Build approval link if baseUrl and leaveRequestId are provided
    let approvalLink = '';
    if (data.baseUrl && data.leaveRequestId) {
      const baseUrl = data.baseUrl.endsWith('/') ? data.baseUrl.slice(0, -1) : data.baseUrl;
      approvalLink = `${baseUrl}/leave-requests/${data.leaveRequestId}`;
    }
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Leave Request Submitted</h2>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Campaign:</td>
              <td style="padding: 8px 0;">${data.campaignName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Employee:</td>
              <td style="padding: 8px 0;">${data.employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Employee Email:</td>
              <td style="padding: 8px 0;">${data.employeeEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Leave Type:</td>
              <td style="padding: 8px 0;"><strong style="color: #2563eb;">${data.leaveType}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Start Date:</td>
              <td style="padding: 8px 0;">${data.startDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">End Date:</td>
              <td style="padding: 8px 0;">${data.endDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Number of Days:</td>
              <td style="padding: 8px 0;"><strong>${data.numberOfDays} day(s)</strong></td>
            </tr>
            ${data.reason ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Reason:</td>
              <td style="padding: 8px 0;">${data.reason}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        ${approvalLink ? `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${approvalLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Review Leave Request
          </a>
        </div>
        ` : ''}
        
        <p style="color: #6b7280; font-size: 14px;">
          ${approvalLink ? 'Please click the link above to review and approve/reject this leave request in the TimeTrack system.' : 'Please review this leave request in the TimeTrack system.'}
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <p style="color: #9ca3af; font-size: 12px;">
          This is an automated notification from TimeTrack Workforce Attendance System.
        </p>
      </div>
    `;

    const text = `
New Leave Request Submitted

Campaign: ${data.campaignName}
Employee: ${data.employeeName}
Employee Email: ${data.employeeEmail}
Leave Type: ${data.leaveType}
Start Date: ${data.startDate}
End Date: ${data.endDate}
Number of Days: ${data.numberOfDays}
${data.reason ? `Reason: ${data.reason}` : ''}
${approvalLink ? `\nReview this request at: ${approvalLink}` : ''}

Please review this leave request in the TimeTrack system.
    `;

    if (this.transporter) {
      try {
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER') || 'noreply@timetracker.com';
        await this.transporter.sendMail({
          from: `"TimeTrack System" <${fromEmail}>`,
          to: data.toEmail,
          subject,
          text,
          html,
        });
        this.logger.log(`Leave request notification sent to ${data.toEmail}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send email to ${data.toEmail}:`, error);
        return false;
      }
    } else {
      // Log the email details when SMTP is not configured
      this.logger.log('========== EMAIL NOTIFICATION (SMTP not configured) ==========');
      this.logger.log(`To: ${data.toEmail}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Campaign: ${data.campaignName}`);
      this.logger.log(`Employee: ${data.employeeName} (${data.employeeEmail})`);
      this.logger.log(`Leave Type: ${data.leaveType}`);
      this.logger.log(`Dates: ${data.startDate} to ${data.endDate} (${data.numberOfDays} days)`);
      if (data.reason) this.logger.log(`Reason: ${data.reason}`);
      this.logger.log('==============================================================');
      return true; // Return true since we logged it
    }
  }

  /** Format time string (e.g. "09:00:00" or "09:00") to readable format */
  private formatTime(timeStr: string | null | undefined): string {
    if (!timeStr) return 'N/A';
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  async sendCampaignAssignmentNotification(data: CampaignAssignmentEmailData): Promise<boolean> {
    const subject = `You have been assigned to campaign: ${data.campaignName}`;
    
    // Build work schedule section
    let scheduleSection = '';
    if (data.workDayStart || data.workDayEnd) {
      scheduleSection += `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Work Hours:</td>
              <td style="padding: 8px 0;">${this.formatTime(data.workDayStart)} - ${this.formatTime(data.workDayEnd)}</td>
            </tr>
      `;
    }
    
    if (data.lunchStart || data.lunchEnd) {
      scheduleSection += `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Lunch Break:</td>
              <td style="padding: 8px 0;">${this.formatTime(data.lunchStart)} - ${this.formatTime(data.lunchEnd)}</td>
            </tr>
      `;
    }
    
    if (data.teaBreaks && data.teaBreaks.length > 0) {
      const teaBreaksText = data.teaBreaks.map((tb, idx) => 
        `Tea Break ${idx + 1}: ${this.formatTime(tb.start)} - ${this.formatTime(tb.end)}`
      ).join('<br>');
      scheduleSection += `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Tea Breaks:</td>
              <td style="padding: 8px 0;">${teaBreaksText}</td>
            </tr>
      `;
    }
    
    // Build team information section
    let teamSection = '';
    if (data.teamLeadName || data.teamLeadEmail) {
      teamSection += `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Team Lead:</td>
              <td style="padding: 8px 0;">${data.teamLeadName || ''}${data.teamLeadEmail ? ` (${data.teamLeadEmail})` : ''}</td>
            </tr>
      `;
    }
    
    if (data.managerName || data.managerEmail) {
      teamSection += `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Manager:</td>
              <td style="padding: 8px 0;">${data.managerName || ''}${data.managerEmail ? ` (${data.managerEmail})` : ''}</td>
            </tr>
      `;
    }
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Campaign Assignment Notification</h2>
        
        <p>Hello ${data.employeeName},</p>
        
        <p>You have been assigned to a new campaign in the TimeTrack system.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2563eb; margin-top: 0;">Campaign Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Campaign Name:</td>
              <td style="padding: 8px 0;"><strong style="color: #2563eb;">${data.campaignName}</strong></td>
            </tr>
            ${data.campaignDescription ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Description:</td>
              <td style="padding: 8px 0;">${data.campaignDescription}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Assigned By:</td>
              <td style="padding: 8px 0;">${data.assignedByName}</td>
            </tr>
          </table>
        </div>
        
        ${scheduleSection ? `
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2563eb; margin-top: 0;">Work Schedule</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${scheduleSection}
          </table>
        </div>
        ` : ''}
        
        ${teamSection ? `
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2563eb; margin-top: 0;">Team Information</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${teamSection}
          </table>
        </div>
        ` : ''}
        
        ${data.eventTypes && data.eventTypes.length > 0 ? `
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #2563eb; margin-top: 0;">Available Clock Actions</h3>
          <p style="color: #4b5563; margin-bottom: 12px;">You can use the following actions in the TimeTrack system:</p>
          <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
            ${data.eventTypes.map(et => `
              <li style="margin: 6px 0;">
                <strong>${et.name}</strong>${et.isBreak ? ' (Break)' : ''} - ${et.category}
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}
        
        <p style="color: #059669; font-weight: 500;">
          You can now clock in/out and apply for leave through the TimeTrack system.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <p style="color: #9ca3af; font-size: 12px;">
          This is an automated notification from TimeTrack Workforce Attendance System.
        </p>
      </div>
    `;

    // Build text version
    let textSchedule = '';
    if (data.workDayStart || data.workDayEnd) {
      textSchedule += `Work Hours: ${this.formatTime(data.workDayStart)} - ${this.formatTime(data.workDayEnd)}\n`;
    }
    if (data.lunchStart || data.lunchEnd) {
      textSchedule += `Lunch Break: ${this.formatTime(data.lunchStart)} - ${this.formatTime(data.lunchEnd)}\n`;
    }
    if (data.teaBreaks && data.teaBreaks.length > 0) {
      textSchedule += 'Tea Breaks:\n';
      data.teaBreaks.forEach((tb, idx) => {
        textSchedule += `  Tea Break ${idx + 1}: ${this.formatTime(tb.start)} - ${this.formatTime(tb.end)}\n`;
      });
    }
    
    let textTeam = '';
    if (data.teamLeadName || data.teamLeadEmail) {
      textTeam += `Team Lead: ${data.teamLeadName || ''}${data.teamLeadEmail ? ` (${data.teamLeadEmail})` : ''}\n`;
    }
    if (data.managerName || data.managerEmail) {
      textTeam += `Manager: ${data.managerName || ''}${data.managerEmail ? ` (${data.managerEmail})` : ''}\n`;
    }

    const text = `
Campaign Assignment Notification

Hello ${data.employeeName},

You have been assigned to a new campaign in the TimeTrack system.

Campaign Name: ${data.campaignName}
${data.campaignDescription ? `Description: ${data.campaignDescription}\n` : ''}Assigned By: ${data.assignedByName}
${textSchedule ? `\nWork Schedule:\n${textSchedule}` : ''}${textTeam ? `\nTeam Information:\n${textTeam}` : ''}${data.eventTypes && data.eventTypes.length > 0 ? `\nAvailable Clock Actions:\n${data.eventTypes.map(et => `  - ${et.name}${et.isBreak ? ' (Break)' : ''} - ${et.category}`).join('\n')}\n` : ''}
You can now clock in/out and apply for leave through the TimeTrack system.
    `;

    if (this.transporter) {
      try {
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER') || 'noreply@timetracker.com';
        await this.transporter.sendMail({
          from: `"TimeTrack System" <${fromEmail}>`,
          to: data.toEmail,
          subject,
          text,
          html,
        });
        this.logger.log(`Campaign assignment notification sent to ${data.toEmail}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send email to ${data.toEmail}:`, error);
        return false;
      }
    } else {
      // Log the email details when SMTP is not configured
      this.logger.log('========== EMAIL NOTIFICATION (SMTP not configured) ==========');
      this.logger.log(`To: ${data.toEmail}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Campaign Assignment: ${data.employeeName} -> ${data.campaignName}`);
      this.logger.log(`Assigned By: ${data.assignedByName}`);
      this.logger.log('==============================================================');
      return true;
    }
  }

  async sendLeaveRequestConfirmation(data: LeaveRequestConfirmationEmailData): Promise<boolean> {
    const subject = `Leave Request Confirmation: ${data.leaveType}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Leave Request Confirmation</h2>
        
        <p>Hello ${data.employeeName},</p>
        
        <p>Your leave request has been successfully submitted and sent to the relevant approvers.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Campaign:</td>
              <td style="padding: 8px 0;">${data.campaignName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Leave Type:</td>
              <td style="padding: 8px 0;"><strong style="color: #2563eb;">${data.leaveType}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Start Date:</td>
              <td style="padding: 8px 0;">${data.startDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">End Date:</td>
              <td style="padding: 8px 0;">${data.endDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Number of Days:</td>
              <td style="padding: 8px 0;"><strong>${data.numberOfDays} day(s)</strong></td>
            </tr>
          </table>
        </div>
        
        <p style="color: #059669; font-weight: 500;">
          Your request is now pending approval. You will be notified once a decision has been made.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <p style="color: #9ca3af; font-size: 12px;">
          This is an automated confirmation from TimeTrack Workforce Attendance System.
        </p>
      </div>
    `;

    const text = `
Leave Request Confirmation

Hello ${data.employeeName},

Your leave request has been successfully submitted and sent to the relevant approvers.

Campaign: ${data.campaignName}
Leave Type: ${data.leaveType}
Start Date: ${data.startDate}
End Date: ${data.endDate}
Number of Days: ${data.numberOfDays} day(s)

Your request is now pending approval. You will be notified once a decision has been made.

This is an automated confirmation from TimeTrack Workforce Attendance System.
    `;

    if (this.transporter) {
      try {
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER') || 'noreply@timetracker.com';
        await this.transporter.sendMail({
          from: `"TimeTrack System" <${fromEmail}>`,
          to: data.toEmail,
          subject,
          text,
          html,
        });
        this.logger.log(`Leave request confirmation sent to ${data.toEmail}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send confirmation email to ${data.toEmail}:`, error);
        return false;
      }
    } else {
      // Log the email details when SMTP is not configured
      this.logger.log('========== EMAIL NOTIFICATION (SMTP not configured) ==========');
      this.logger.log(`To: ${data.toEmail}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Leave Request Confirmation: ${data.employeeName} - ${data.leaveType}`);
      this.logger.log(`Campaign: ${data.campaignName}`);
      this.logger.log(`Dates: ${data.startDate} to ${data.endDate} (${data.numberOfDays} days)`);
      this.logger.log('==============================================================');
      return true;
    }
  }

  async sendLateArrivalNotification(data: LateArrivalEmailData): Promise<boolean> {
    const subject = data.isEscalation
      ? `URGENT: Late arrival escalation – ${data.employeeName} (${data.lateMinutes} min)`
      : `Late arrival – ${data.employeeName} (${data.lateMinutes} min)`;

    const accent = data.isEscalation ? '#dc2626' : '#f59e0b';
    const content = `
      <p style="margin: 0 0 20px; color: #334155; font-size: 15px;">
        ${data.isEscalation
          ? 'An employee has not clocked in and is <strong>30+ minutes late</strong>. This is an escalation requiring attention.'
          : 'An employee has not clocked in on time.'}
      </p>
      <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px; overflow: hidden;">
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 140px;">Employee</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${data.employeeName}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Email</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${data.employeeEmail}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Campaign</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">${data.campaignName}</td></tr>
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569;">Minutes late</td><td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;"><strong style="color: ${accent};">${data.lateMinutes} min</strong></td></tr>
        <tr><td style="padding: 12px 16px; font-weight: 600; color: #475569;">Time</td><td style="padding: 12px 16px;">${new Date().toLocaleString()}</td></tr>
      </table>
      ${data.isEscalation ? `<p style="margin: 20px 0 0; padding: 12px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px; color: #991b1b; font-weight: 500;">Immediate action may be required. Please follow up with the employee and team leader.</p>` : ''}
    `;
    const html = this.emailWrapper(
      data.isEscalation ? 'Late arrival escalation' : 'Late arrival notification',
      content,
      accent
    );

    const text = `
${data.isEscalation ? 'URGENT: Late Arrival Escalation' : 'Late Arrival Notification'}

${data.isEscalation ? 'This is an escalation notification.' : 'An employee has not clocked in on time.'}

Employee: ${data.employeeName} (${data.employeeEmail})
Campaign: ${data.campaignName}
Minutes Late: ${data.lateMinutes} minutes
Time: ${new Date().toLocaleString()}

${data.isEscalation ? 'This employee has been late for more than 30 minutes. Immediate action may be required.' : ''}

This is an automated notification from Time Tracker System
    `;

    if (this.transporter) {
      try {
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER') || 'noreply@timetracker.com';
        await this.transporter.sendMail({
          from: `"TimeTrack System" <${fromEmail}>`,
          to: data.toEmail,
          subject,
          html,
          text,
        });
        this.logger.log(`Late arrival notification sent to ${data.toEmail}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send late arrival notification to ${data.toEmail}:`, error);
        return false;
      }
    } else {
      this.logger.log('========== EMAIL NOTIFICATION (SMTP not configured) ==========');
      this.logger.log(`To: ${data.toEmail}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Late Arrival: ${data.employeeName} - ${data.lateMinutes} minutes late`);
      this.logger.log(`Campaign: ${data.campaignName}`);
      this.logger.log(`Escalation: ${data.isEscalation}`);
      this.logger.log('==============================================================');
      return true;
    }
  }

  async sendTeamLeaderPromotionNotification(data: TeamLeaderPromotionEmailData): Promise<boolean> {
    const subject = data.campaignName 
      ? `You’re a Team Leader: ${data.campaignName}`
      : `Team Leader promotion: ${data.employeeName}`;
    
    const responsibilities = data.responsibilities || [
      'Monitor team attendance and punctuality',
      'Receive late arrival notifications (15+ minutes)',
      'Escalate critical attendance issues to management',
      'Support team members with time tracking questions',
    ];
    
    const content = `
      <p style="margin: 0 0 20px; color: #334155; font-size: 15px;">Hello <strong>${data.employeeName}</strong>,</p>
      <p style="margin: 0 0 24px; color: #334155;">Congratulations — you have been assigned as Team Leader${data.campaignName ? ` for <strong style="color: #2563eb;">${data.campaignName}</strong>` : ''}.</p>
      ${data.campaignName ? `
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 4px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Campaign</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${data.campaignName}</p>
        ${data.campaignDescription ? `<p style="margin: 8px 0 0; font-size: 14px; color: #64748b;">${data.campaignDescription}</p>` : ''}
      </div>
      ` : ''}
      <div style="background: #eff6ff; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
        <p style="margin: 0 0 12px; font-weight: 600; color: #1e40af;">Your responsibilities</p>
        <ul style="margin: 0; padding-left: 20px; color: #334155;">
          ${responsibilities.map(resp => `<li style="margin: 6px 0;">${resp}</li>`).join('')}
        </ul>
      </div>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Promoted by: <strong>${data.promotedByName}</strong></p>
    `;
    const html = this.emailWrapper('Team Leader assignment', content);

    let textTeamLeader = '';
    if (data.teamLeaderName || data.teamLeaderEmail) {
      textTeamLeader = `Your Team Leader: ${data.teamLeaderName || ''}${data.teamLeaderEmail ? ` (${data.teamLeaderEmail})` : ''}\n`;
    }

    const text = `
Team Leader Promotion

Hello ${data.employeeName},

Congratulations! You have been promoted to Team Leader${data.campaignName ? ` for the campaign: ${data.campaignName}` : ''}.

${data.campaignName ? `Campaign Name: ${data.campaignName}\n${data.campaignDescription ? `Description: ${data.campaignDescription}\n` : ''}` : ''}Your Responsibilities:
${responsibilities.map(resp => `  - ${resp}`).join('\n')}

${textTeamLeader}What This Means:
As a Team Leader, you will receive automated notifications when team members are late or have attendance issues. 
You can access the Manager Dashboard in TimeTrack to view team attendance reports and manage leave requests.

Promoted By: ${data.promotedByName}

This is an automated notification from TimeTrack Workforce Attendance System.
    `;

    if (this.transporter) {
      try {
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER') || 'noreply@timetracker.com';
        await this.transporter.sendMail({
          from: `"TimeTrack System" <${fromEmail}>`,
          to: data.toEmail,
          subject,
          text,
          html,
        });
        this.logger.log(`Team leader promotion notification sent to ${data.toEmail}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send team leader promotion email to ${data.toEmail}:`, error);
        return false;
      }
    } else {
      this.logger.log('========== EMAIL NOTIFICATION (SMTP not configured) ==========');
      this.logger.log(`To: ${data.toEmail}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Team Leader Promotion: ${data.employeeName}${data.campaignName ? ` -> ${data.campaignName}` : ''}`);
      this.logger.log(`Promoted By: ${data.promotedByName}`);
      this.logger.log('==============================================================');
      return true;
    }
  }

  async sendTeamMemberAssignmentNotification(data: TeamMemberAssignmentEmailData): Promise<boolean> {
    const subject = `Your team leader: ${data.teamLeaderName}`;
    
    const content = `
      <p style="margin: 0 0 20px; color: #334155; font-size: 15px;">Hello <strong>${data.employeeName}</strong>,</p>
      <p style="margin: 0 0 24px; color: #334155;">You have been assigned to a team leader for your campaign${data.campaignName ? `: <strong style="color: #2563eb;">${data.campaignName}</strong>` : ''}.</p>
      <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
        <p style="margin: 0 0 12px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Your team leader</p>
        <p style="margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #1e40af;">${data.teamLeaderName}</p>
        <p style="margin: 0; font-size: 14px; color: #64748b;">${data.teamLeaderEmail}</p>
      </div>
      ${data.campaignName ? `<p style="margin: 0 0 16px; color: #64748b; font-size: 14px;">Campaign: <strong>${data.campaignName}</strong></p>` : ''}
      <p style="margin: 0 0 8px; color: #334155; font-size: 14px;">Your team leader will monitor attendance and can help with time tracking or leave. They receive notifications if you are late.</p>
      <p style="margin: 20px 0 0; color: #64748b; font-size: 14px;">Assigned by: <strong>${data.assignedByName}</strong></p>
    `;
    const html = this.emailWrapper('Team leader assignment', content);

    const text = `
Team Leader Assignment

Hello ${data.employeeName},

You have been assigned to a team leader for your campaign${data.campaignName ? `: ${data.campaignName}` : ''}.

Your Team Leader:
Name: ${data.teamLeaderName}
Email: ${data.teamLeaderEmail}

${data.campaignName ? `Campaign: ${data.campaignName}\n` : ''}What This Means:
Your team leader will monitor your attendance and can help you with any questions about time tracking or leave requests. 
They will receive notifications if you are late or have attendance issues.

Assigned By: ${data.assignedByName}

This is an automated notification from TimeTrack Workforce Attendance System.
    `;

    if (this.transporter) {
      try {
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER') || 'noreply@timetracker.com';
        await this.transporter.sendMail({
          from: `"TimeTrack System" <${fromEmail}>`,
          to: data.toEmail,
          subject,
          text,
          html,
        });
        this.logger.log(`Team member assignment notification sent to ${data.toEmail}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send team member assignment email to ${data.toEmail}:`, error);
        return false;
      }
    } else {
      this.logger.log('========== EMAIL NOTIFICATION (SMTP not configured) ==========');
      this.logger.log(`To: ${data.toEmail}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Team Member Assignment: ${data.employeeName} -> Team Leader: ${data.teamLeaderName}`);
      this.logger.log(`Assigned By: ${data.assignedByName}`);
      this.logger.log('==============================================================');
      return true;
    }
  }

  async sendTeamLeaderAssignmentNotification(data: TeamLeaderAssignmentEmailData): Promise<boolean> {
    const subject = `${data.employeeNames.length} team member(s) assigned to you – ${data.campaignName || 'TimeTrack'}`;
    
    const employeeList = data.employeeNames.map(name => `<li style="margin: 8px 0;">${name}</li>`).join('');
    
    const content = `
      <p style="margin: 0 0 20px; color: #334155; font-size: 15px;">Hello <strong>${data.teamLeaderName}</strong>,</p>
      <p style="margin: 0 0 24px; color: #334155;">You have been assigned <strong>${data.employeeNames.length} team member(s)</strong>${data.campaignName ? ` for <strong style="color: #2563eb;">${data.campaignName}</strong>` : ''}.</p>
      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 12px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Your team members</p>
        <ul style="margin: 0; padding-left: 20px; color: #334155;">
          ${employeeList}
        </ul>
      </div>
      ${data.campaignName ? `<p style="margin: 0 0 16px; color: #64748b; font-size: 14px;">Campaign: <strong>${data.campaignName}</strong></p>` : ''}
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 4px solid #059669;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #047857;">Your responsibilities</p>
        <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px;">
          <li style="margin: 4px 0;">Monitor team attendance and punctuality</li>
          <li style="margin: 4px 0;">Receive late arrival notifications (15+ minutes)</li>
          <li style="margin: 4px 0;">Escalate critical attendance issues to management</li>
          <li style="margin: 4px 0;">Support team members with time tracking questions</li>
        </ul>
      </div>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Assigned by: <strong>${data.assignedByName}</strong></p>
    `;
    const html = this.emailWrapper('New team members assigned', content);

    const text = `
New Team Members Assigned

Hello ${data.teamLeaderName},

You have been assigned ${data.employeeNames.length} new team member(s)${data.campaignName ? ` for the campaign: ${data.campaignName}` : ''}.

Your Team Members:
${data.employeeNames.map(name => `  - ${name}`).join('\n')}

${data.campaignName ? `Campaign: ${data.campaignName}\n` : ''}Your Responsibilities:
  - Monitor team attendance and punctuality
  - Receive late arrival notifications (15+ minutes)
  - Escalate critical attendance issues to management
  - Support team members with time tracking questions

Assigned By: ${data.assignedByName}

This is an automated notification from TimeTrack Workforce Attendance System.
    `;

    if (this.transporter) {
      try {
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER') || 'noreply@timetracker.com';
        await this.transporter.sendMail({
          from: `"TimeTrack System" <${fromEmail}>`,
          to: data.toEmail,
          subject,
          text,
          html,
        });
        this.logger.log(`Team leader assignment notification sent to ${data.toEmail}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send team leader assignment email to ${data.toEmail}:`, error);
        return false;
      }
    } else {
      this.logger.log('========== EMAIL NOTIFICATION (SMTP not configured) ==========');
      this.logger.log(`To: ${data.toEmail}`);
      this.logger.log(`Subject: ${subject}`);
      this.logger.log(`Team Leader Assignment: ${data.teamLeaderName} -> ${data.employeeNames.length} team member(s)`);
      this.logger.log(`Team Members: ${data.employeeNames.join(', ')}`);
      this.logger.log(`Assigned By: ${data.assignedByName}`);
      this.logger.log('==============================================================');
      return true;
    }
  }
}
