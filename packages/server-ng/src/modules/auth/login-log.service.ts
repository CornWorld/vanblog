import { Injectable, Inject } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { loginLogs } from '../../database/schema';

import { LoginLogDto, LoginLogResponseDto, LoginLogQueryDto } from './dto/login-log.dto';

@Injectable()
export class LoginLogService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async createLog(logData: LoginLogDto): Promise<void> {
    await this.db.insert(loginLogs).values({
      username: logData.username,
      ip: logData.ip ? logData.ip : null,
      userAgent: logData.userAgent ? logData.userAgent : null,
      success: logData.success,
      message: logData.message ? logData.message : null,
    });
  }

  async getLogs(query: LoginLogQueryDto): Promise<LoginLogResponseDto[]> {
    const conditions = [];

    const start = query.startDate ? dayjs(query.startDate).format() : undefined;
    const end = query.endDate ? dayjs(query.endDate).format() : undefined;

    if (query.username) {
      conditions.push(eq(loginLogs.username, query.username));
    }

    if (query.success !== undefined) {
      conditions.push(eq(loginLogs.success, query.success));
    }

    if (start) {
      conditions.push(gte(loginLogs.createdAt, start));
    }

    if (end) {
      conditions.push(lte(loginLogs.createdAt, end));
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
      success: log.success,
      message: log.message,
      createdAt: dayjs(log.createdAt).format(),
    }));
  }

  async getRecentFailedAttempts(username: string, minutes = 30): Promise<number> {
    const cutoffTime = dayjs().subtract(minutes, 'minute').format();

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

  async getRecentFailedAttemptsByIp(ip: string, minutes = 30): Promise<number> {
    const cutoffTime = dayjs().subtract(minutes, 'minute').format();

    const result = await this.db
      .select()
      .from(loginLogs)
      .where(
        and(
          eq(loginLogs.ip, ip),
          eq(loginLogs.success, false),
          gte(loginLogs.createdAt, cutoffTime),
        ),
      );

    return result.length;
  }
}
