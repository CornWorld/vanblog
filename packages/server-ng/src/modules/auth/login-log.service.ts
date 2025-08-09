import { Injectable, Inject } from '@nestjs/common';
import dayjs from 'dayjs';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../database';
import { loginLogs } from '../../database/schema';

import { LoginLogDto, LoginLogResponseDto, LoginLogQueryDto } from './dto/login-log.dto';

import type { Database } from '../../database/connection';

@Injectable()
export class LoginLogService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async createLog(logData: LoginLogDto): Promise<void> {
    await this.db.insert(loginLogs).values({
      username: String(logData.username),
      ip: logData.ip ? String(logData.ip) : null,
      userAgent: logData.userAgent ? String(logData.userAgent) : null,
      success: Boolean(logData.success),
      message: logData.message ? String(logData.message) : null,
    });
  }

  async getLogs(query: LoginLogQueryDto): Promise<LoginLogResponseDto[]> {
    const conditions = [];

    if (query.username) {
      conditions.push(eq(loginLogs.username, String(query.username)));
    }

    if (query.success !== undefined) {
      conditions.push(eq(loginLogs.success, Boolean(query.success)));
    }

    if (query.startDate) {
      conditions.push(gte(loginLogs.createdAt, query.startDate));
    }

    if (query.endDate) {
      conditions.push(lte(loginLogs.createdAt, query.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const logs = await this.db
      .select()
      .from(loginLogs)
      .where(whereClause)
      .orderBy(desc(loginLogs.createdAt))
      .limit(100);

    return logs.map((log) => ({
      id: log.id,
      username: log.username,
      ip: log.ip,
      userAgent: log.userAgent,
      success: Boolean(log.success),
      message: log.message,
      createdAt: dayjs(log.createdAt),
    }));
  }

  async getRecentFailedAttempts(username: string, minutes = 30): Promise<number> {
    const cutoffTime = dayjs().subtract(minutes, 'minute').toISOString();

    const result = await this.db
      .select()
      .from(loginLogs)
      .where(
        and(
          eq(loginLogs.username, username),
          eq(loginLogs.success, false),
          gte(loginLogs.createdAt, cutoffTime),
        ),
      );

    return result.length;
  }
}
