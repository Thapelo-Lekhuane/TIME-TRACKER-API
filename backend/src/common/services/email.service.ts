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
}

export interface LateArrivalEmailData {
  toEmail: string;
  employeeName: string;
  employeeEmail: string;
  campaignName: string;
  lateMinutes: number;
  isEscalation: boolean;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
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
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log('Email transporter initialized successfully');
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
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
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

  async sendCampaignAssignmentNotification(data: CampaignAssignmentEmailData): Promise<boolean> {
    const subject = `You have been assigned to campaign: ${data.campaignName}`;
    
    // Build work schedule section
    let scheduleSection = '';
    if (data.workDayStart || data.workDayEnd) {
      scheduleSection += `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Work Hours:</td>
              <td style="padding: 8px 0;">${data.workDayStart || 'N/A'} - ${data.workDayEnd || 'N/A'}</td>
            </tr>
      `;
    }
    
    if (data.lunchStart || data.lunchEnd) {
      scheduleSection += `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #4b5563;">Lunch Break:</td>
              <td style="padding: 8px 0;">${data.lunchStart || 'N/A'} - ${data.lunchEnd || 'N/A'}</td>
            </tr>
      `;
    }
    
    if (data.teaBreaks && data.teaBreaks.length > 0) {
      const teaBreaksText = data.teaBreaks.map((tb, idx) => 
        `Tea Break ${idx + 1}: ${tb.start} - ${tb.end}`
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
      textSchedule += `Work Hours: ${data.workDayStart || 'N/A'} - ${data.workDayEnd || 'N/A'}\n`;
    }
    if (data.lunchStart || data.lunchEnd) {
      textSchedule += `Lunch Break: ${data.lunchStart || 'N/A'} - ${data.lunchEnd || 'N/A'}\n`;
    }
    if (data.teaBreaks && data.teaBreaks.length > 0) {
      textSchedule += 'Tea Breaks:\n';
      data.teaBreaks.forEach((tb, idx) => {
        textSchedule += `  Tea Break ${idx + 1}: ${tb.start} - ${tb.end}\n`;
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
${textSchedule ? `\nWork Schedule:\n${textSchedule}` : ''}${textTeam ? `\nTeam Information:\n${textTeam}` : ''}
You can now clock in/out and apply for leave through the TimeTrack system.
    `;

    if (this.transporter) {
      try {
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
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
        const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');
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
      ? `URGENT: Employee ${data.employeeName} is ${data.lateMinutes} minutes late`
      : `Employee ${data.employeeName} is ${data.lateMinutes} minutes late`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${data.isEscalation ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9fafb; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #4b5563; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${data.isEscalation ? '⚠️ Late Arrival Escalation' : '⏰ Late Arrival Notification'}</h2>
          </div>
          <div class="content">
            <p>${data.isEscalation ? 'This is an escalation notification.' : 'An employee has not clocked in on time.'}</p>
            <div class="info-row">
              <span class="label">Employee:</span> ${data.employeeName} (${data.employeeEmail})
            </div>
            <div class="info-row">
              <span class="label">Campaign:</span> ${data.campaignName}
            </div>
            <div class="info-row">
              <span class="label">Minutes Late:</span> <strong style="color: ${data.isEscalation ? '#dc2626' : '#f59e0b'};">${data.lateMinutes} minutes</strong>
            </div>
            <div class="info-row">
              <span class="label">Time:</span> ${new Date().toLocaleString()}
            </div>
            ${data.isEscalation ? '<p style="color: #dc2626; font-weight: bold;">This employee has been late for more than 30 minutes. Immediate action may be required.</p>' : ''}
          </div>
          <div class="footer">
            <p>This is an automated notification from Time Tracker System</p>
          </div>
        </div>
      </body>
      </html>
    `;

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
}
