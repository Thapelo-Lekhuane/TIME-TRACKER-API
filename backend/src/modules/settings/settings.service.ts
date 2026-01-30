import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Setting } from './setting.entity';

export const KEY_ESCALATED_LATE_EMAIL = 'escalated_late_email';
const KEY_LATE_ESCALATION_SENT = 'late_escalation_sent';
const ESCALATION_SENT_RETAIN_DAYS = 3;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
    private readonly configService: ConfigService,
  ) {}

  /** Returns true if the 30-min escalation email was already sent to the escalator for this user on this date (persists across restarts). */
  async wasEscalationSentToEscalator(userId: string, dateStr: string): Promise<boolean> {
    const data = await this.getEscalationSentData();
    const userIds = data[dateStr];
    return Array.isArray(userIds) && userIds.includes(userId);
  }

  /** Mark that the 30-min escalation email was sent to the escalator for this user on this date. */
  async markEscalationSentToEscalator(userId: string, dateStr: string): Promise<void> {
    const data = await this.getEscalationSentData();
    if (!data[dateStr]) data[dateStr] = [];
    if (!data[dateStr].includes(userId)) data[dateStr].push(userId);
    const pruned = this.pruneOldEscalationDates(data);
    await this.repo.upsert({ key: KEY_LATE_ESCALATION_SENT, value: JSON.stringify(pruned) }, ['key']);
  }

  private async getEscalationSentData(): Promise<Record<string, string[]>> {
    const raw = await this.repo.findOne({ where: { key: KEY_LATE_ESCALATION_SENT } });
    if (!raw?.value) return {};
    try {
      return this.pruneOldEscalationDates(JSON.parse(raw.value) as Record<string, string[]>);
    } catch {
      return {};
    }
  }

  private pruneOldEscalationDates(data: Record<string, string[]>): Record<string, string[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ESCALATION_SENT_RETAIN_DAYS);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const out: Record<string, string[]> = {};
    for (const [date, userIds] of Object.entries(data)) {
      if (date >= cutoffStr && Array.isArray(userIds)) out[date] = userIds;
    }
    return out;
  }

  async get(key: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { key } });
    if (row != null) return row.value ?? null;
    // Fallback to env for escalated late email when not set in DB
    if (key === KEY_ESCALATED_LATE_EMAIL) {
      return this.configService.get<string>('ESCALATED_LATE_EMAIL') ?? null;
    }
    return null;
  }

  async set(key: string, value: string | null): Promise<void> {
    await this.repo.upsert({ key, value: value ?? null }, ['key']);
  }

  async getEscalatedLateEmail(): Promise<string | null> {
    return this.get(KEY_ESCALATED_LATE_EMAIL);
  }

  async setEscalatedLateEmail(email: string | null): Promise<void> {
    await this.set(KEY_ESCALATED_LATE_EMAIL, email);
  }

  async getAll(): Promise<Record<string, string | null>> {
    const rows = await this.repo.find();
    const out: Record<string, string | null> = {};
    for (const r of rows) {
      out[r.key] = r.value;
    }
    if (out[KEY_ESCALATED_LATE_EMAIL] == null) {
      out[KEY_ESCALATED_LATE_EMAIL] = this.configService.get<string>('ESCALATED_LATE_EMAIL') ?? null;
    }
    return out;
  }
}
