import * as crypto from 'crypto';

import { Injectable, Inject, Logger } from '@nestjs/common';
import { dayjs } from '@vanblog/shared';
import { siteMeta } from '@vanblog/shared/drizzle';
import { eq } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';

export interface ApiToken {
  _id: string;
  name: string;
  token: string;
  createdAt: string;
}

@Injectable()
export class ApiTokenService {
  private readonly logger = new Logger(ApiTokenService.name);
  private readonly configKey = 'apiTokens';

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {}

  async getAllTokens(): Promise<ApiToken[]> {
    const results = await this.db
      .select()
      .from(siteMeta)
      .where(eq(siteMeta.key, this.configKey))
      .limit(1);

    if (results.length > 0 && results[0].value != null) {
      return results[0].value as ApiToken[];
    }
    return [];
  }

  async createToken(name: string): Promise<ApiToken> {
    const tokens = await this.getAllTokens();
    const token = this.generateToken();
    const newToken: ApiToken = {
      _id: this.generateId(),
      name,
      token,
      createdAt: dayjs().format(),
    };

    tokens.push(newToken);
    await this.saveTokens(tokens);
    this.logger.log(`Created API token: ${newToken._id} (${name})`);
    return newToken;
  }

  async deleteToken(id: string): Promise<boolean> {
    const tokens = await this.getAllTokens();
    const filteredTokens = tokens.filter((t) => t._id !== id);

    if (filteredTokens.length === tokens.length) {
      return false; // Token not found
    }

    await this.saveTokens(filteredTokens);
    this.logger.log(`Deleted API token: ${id}`);
    return true;
  }

  private async saveTokens(tokens: ApiToken[]): Promise<void> {
    await this.db
      .insert(siteMeta)
      .values({
        key: this.configKey,
        value: tokens,
      })
      .onConflictDoUpdate({
        target: siteMeta.key,
        set: {
          value: tokens,
          updatedAt: new Date(),
        },
      });
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateToken(): string {
    // Generate a secure random token
    const prefix = 'vanblog_';
    const randomPart = crypto.randomBytes(32).toString('hex');
    return `${prefix}${randomPart}`;
  }
}
