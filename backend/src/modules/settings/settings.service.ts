import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Setting } from './setting.entity';

export const KEY_ESCALATED_LATE_EMAIL = 'escalated_late_email';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
    private readonly configService: ConfigService,
  ) {}

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
