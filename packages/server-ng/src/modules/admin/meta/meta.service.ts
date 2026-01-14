import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as semver from 'semver';

/**
 * 管理端元数据服务
 *
 * 提供版本信息、系统状态等管理端需要的元数据
 */
@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private currentVersion = 'dev';
  private latestVersionInfo: {
    version: string;
    description: string;
    url: string;
  } | null = null;
  private lastCheckTime = 0;
  private readonly CHECK_INTERVAL = 1000 * 60 * 60; // 1 hour

  constructor() {
    this.initVersion();
  }

  private initVersion(): void {
    try {
      const pkgPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
          version?: string;
        };
        this.currentVersion = pkg.version ?? 'dev';
      } else {
        this.currentVersion = process.env.npm_package_version ?? 'dev';
      }
    } catch (error) {
      this.logger.warn('Failed to read package.json', error);
      this.currentVersion = process.env.npm_package_version ?? 'dev';
    }

    // Initial check in background
    void this.checkUpdate();
  }

  private async checkUpdate(): Promise<void> {
    if (Date.now() - this.lastCheckTime < this.CHECK_INTERVAL && this.latestVersionInfo) {
      return;
    }

    // Update timestamp to prevent concurrent checks flooding
    this.lastCheckTime = Date.now();

    try {
      const { data } = await axios.get<{
        tag_name: string;
        body: string;
        html_url: string;
      }>('https://api.github.com/repos/Mereithhh/vanblog/releases/latest', {
        timeout: 5000,
      });

      this.latestVersionInfo = {
        version: data.tag_name,
        description: data.body,
        url: data.html_url,
      };
      this.logger.log(`Updated latest version info: ${data.tag_name}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to check update: ${message}`);
    }
  }

  /**
   * 获取版本信息
   */
  getVersionInfo(): {
    version: string;
    latestVersion: string;
    hasUpdate: boolean;
    updateInfo?: {
      version: string;
      description: string;
      url: string;
    };
  } {
    // Trigger update if needed, but don't await
    void this.checkUpdate();

    const latestVersion = this.latestVersionInfo?.version ?? this.currentVersion;
    const hasUpdate = this.latestVersionInfo
      ? (semver.gt(this.latestVersionInfo.version, this.currentVersion) as boolean)
      : false;

    return {
      version: this.currentVersion,
      latestVersion,
      hasUpdate,
      updateInfo: this.latestVersionInfo ?? undefined,
    };
  }
}
