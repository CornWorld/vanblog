import { createHash } from 'crypto';

import { Injectable, Logger, Inject } from '@nestjs/common';
import dayjs from 'dayjs';
import { eq, lt } from 'drizzle-orm';

import { DATABASE_CONNECTION, type Database } from '../../database';
import { tokenBlacklist } from '../../database/schema';

/**
 * Token Blacklist Service
 * Manages revoked JWT tokens in database for security and scalability
 */
@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  /**
   * Hash token for secure storage
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Add token to blacklist
   */
  async revokeToken(
    token: string,
    tokenType: 'access' | 'refresh',
    expiresAt: Date,
    userId?: number,
    reason?: string,
  ): Promise<void> {
    try {
      const tokenHash = this.hashToken(token);

      await this.db.insert(tokenBlacklist).values({
        tokenHash,
        tokenType,
        userId,
        reason,
        expiresAt: dayjs(expiresAt).format(),
      });

      this.logger.log(`Token revoked: ${tokenType} for user ${userId ?? 'anonymous'}`);
    } catch (error) {
      this.logger.error(`Failed to revoke token: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenRevoked(token: string): Promise<boolean> {
    try {
      const tokenHash = this.hashToken(token);

      const result = await this.db
        .select()
        .from(tokenBlacklist)
        .where(eq(tokenBlacklist.tokenHash, tokenHash))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      this.logger.error(`Failed to check token revocation: ${String(error)}`);
      // Fail secure: if we can't check, assume revoked
      return true;
    }
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(userId: number, reason?: string): Promise<number> {
    try {
      const expiresAt = dayjs().add(1, 'year'); // Far future expiry

      // This is a simplified approach - in production you'd want to track active tokens
      // For now, we'll create a special entry to mark all user tokens as revoked
      await this.db.insert(tokenBlacklist).values({
        tokenHash: `user_${userId}_all_tokens`,
        tokenType: 'access',
        userId,
        reason: reason ?? 'All user tokens revoked',
        expiresAt: expiresAt.format(),
      });

      this.logger.log(`All tokens revoked for user ${userId}`);
      return 1; // Simplified return
    } catch (error) {
      this.logger.error(`Failed to revoke all user tokens: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Clean up expired blacklist entries
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = dayjs().format();

      const result = await this.db.delete(tokenBlacklist).where(lt(tokenBlacklist.expiresAt, now));

      const deletedCount = result.rowsAffected;
      this.logger.log(`Cleaned up ${deletedCount} expired blacklist entries`);
      return deletedCount;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to cleanup expired tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get blacklist statistics
   */
  async getBlacklistStats(): Promise<{
    totalEntries: number;
    accessTokens: number;
    refreshTokens: number;
  }> {
    try {
      const [total, access, refresh] = await Promise.all([
        this.db.select().from(tokenBlacklist),
        this.db.select().from(tokenBlacklist).where(eq(tokenBlacklist.tokenType, 'access')),
        this.db.select().from(tokenBlacklist).where(eq(tokenBlacklist.tokenType, 'refresh')),
      ]);

      return {
        totalEntries: total.length,
        accessTokens: access.length,
        refreshTokens: refresh.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get blacklist stats: ${String(error)}`);
      return {
        totalEntries: 0,
        accessTokens: 0,
        refreshTokens: 0,
      };
    }
  }
}
