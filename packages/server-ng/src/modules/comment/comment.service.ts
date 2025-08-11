import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, spawn } from 'node:child_process';
import { AllConfig } from '../../config/config.interface';
import { SettingCoreService } from '../setting/services/setting-core.service';
import { HookService } from '../plugin/services/hook.service';

import { UpdateWalineSetting, WalineSetting } from './comment.schema';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);
  private walineProcess: ChildProcess | null = null;
  private walineEnv: Record<string, string> = {};

  constructor(
    private readonly configService: ConfigService<AllConfig>,
    private readonly settingService: SettingCoreService,
    private readonly hookService: HookService,
  ) {}

  async getWalineSetting(): Promise<WalineSetting> {
    const defaultSetting: WalineSetting = {
      smtp: {
        enabled: false,
        port: 587,
        host: '',
        user: '',
        password: '',
      },
      sender: {
        name: '',
        email: '',
      },
      authorEmail: '',
      webhook: '',
      forceLoginComment: false,
      otherConfig: '',
      serverURL: '',
    };
    return (
      (await this.settingService.getConfig<WalineSetting>('walineSetting', defaultSetting)) ??
      defaultSetting
    );
  }

  async updateWalineSetting(data: UpdateWalineSetting): Promise<WalineSetting> {
    const existing = await this.getWalineSetting();

    // Apply beforeUpdate filter hook
    const filteredData = await this.hookService.applyFilters('comment|beforeUpdate', data, {
      action: 'update',
      existing,
    });

    const updated = { ...existing, ...filteredData };
    const result = await this.settingService.updateConfig('walineSetting', updated);

    // Restart Waline with new settings
    await this.restart('配置更新');

    // Trigger afterUpdate action hook
    await this.hookService.doAction('comment|afterUpdate', result, {
      action: 'update',
      previous: existing,
      changes: filteredData,
    });

    return result;
  }

  private mapConfigToEnv(config: WalineSetting): Record<string, string> {
    const walineEnvMapping = {
      'smtp.port': 'SMTP_PORT',
      'smtp.host': 'SMTP_HOST',
      'smtp.user': 'SMTP_USER',
      'sender.name': 'SENDER_NAME',
      'sender.email': 'SENDER_EMAIL',
      'smtp.password': 'SMTP_PASS',
      authorEmail: 'AUTHOR_EMAIL',
      webhook: 'WEBHOOK',
      forceLoginComment: 'LOGIN',
      serverURL: 'VAN_BLOG_WALINE_URL',
    };

    const result: Record<string, string> = {};
    if (!config) {
      return result;
    }

    for (const [key, value] of Object.entries(config)) {
      if (key === 'forceLoginComment') {
        if (config.forceLoginComment) {
          result['LOGIN'] = 'force';
        }
      } else if (key === 'otherConfig') {
        if (config.otherConfig) {
          try {
            const data = JSON.parse(config.otherConfig);
            for (const [k, v] of Object.entries(data)) {
              result[k] = String(v);
            }
          } catch (err) {
            this.logger.warn('Failed to parse otherConfig:', err);
          }
        }
      } else {
        const envKey = walineEnvMapping[key as keyof typeof walineEnvMapping];
        if (envKey && value !== undefined) {
          result[envKey] = String(value);
        }
      }
    }

    // Remove SMTP related env vars if SMTP is disabled
    if (!config['smtp.enabled']) {
      const filteredResult: Record<string, string> = {};
      for (const [k, v] of Object.entries(result)) {
        if (
          ![
            'SMTP_PASS',
            'SMTP_USER',
            'SMTP_HOST',
            'SMTP_PORT',
            'SENDER_NAME',
            'SENDER_EMAIL',
          ].includes(k)
        ) {
          filteredResult[k] = v;
        }
      }
      return filteredResult;
    }

    return result;
  }

  private async loadEnv(): Promise<void> {
    const walineDb = this.configService.get('waline.db', { infer: true });

    // Database configuration for Waline
    const mongoEnv = {
      MONGO_DB: walineDb,
      MONGO_AUTHSOURCE: 'admin',
    };

    // Site information
    const siteInfo = await this.settingService.getSiteInfo();
    const otherEnv = {
      SITE_NAME: siteInfo?.title || undefined,
      SITE_URL: 'http://localhost:3000',
      JWT_TOKEN: this.configService.get('jwt.secret', { infer: true }),
    };

    // Waline specific configuration
    const walineConfig = await this.getWalineSetting();
    const walineConfigEnv = walineConfig ? this.mapConfigToEnv(walineConfig) : {};

    this.walineEnv = {
      ...mongoEnv,
      ...otherEnv,
      ...walineConfigEnv,
    };

    this.logger.log(`Waline 配置: ${JSON.stringify(this.walineEnv, null, 2)}`);
  }

  async start(): Promise<void> {
    // Trigger beforeStart action hook
    await this.hookService.doAction('comment|beforeStart', {}, { action: 'start' });

    await this.loadEnv();

    if (this.walineProcess === null) {
      const walinePath = '../waline/node_modules/@waline/vercel/vanilla.js';

      this.walineProcess = spawn('node', [walinePath], {
        env: {
          ...process.env,
          ...this.walineEnv,
        },
        cwd: process.cwd(),
        detached: true,
      });

      this.walineProcess.on('message', (message) => {
        this.logger.log(message);
      });

      this.walineProcess.on('exit', () => {
        this.walineProcess = null;
        this.logger.warn('Waline 进程退出');
        // Trigger process exit hook
        this.hookService.doAction('comment|processExit', {}, { action: 'exit' });
      });

      this.walineProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (!output.includes('Cannot find module')) {
          this.logger.log(output.substring(0, output.length - 1));
        }
      });

      this.walineProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        this.logger.error(output.substring(0, output.length - 1));
      });

      this.logger.log('Waline 启动成功！');

      // Trigger afterStart action hook
      await this.hookService.doAction(
        'comment|afterStart',
        {
          pid: this.walineProcess.pid,
          env: this.walineEnv,
        },
        { action: 'start' },
      );
    } else {
      await this.stop();
      await this.start();
    }
  }

  async stop(): Promise<void> {
    if (this.walineProcess) {
      const pid = this.walineProcess.pid;

      // Trigger beforeStop action hook
      await this.hookService.doAction('comment|beforeStop', { pid }, { action: 'stop' });

      this.walineProcess.unref();
      if (this.walineProcess.pid) {
        process.kill(-this.walineProcess.pid);
      }
      this.walineProcess = null;
      this.logger.log('Waline 停止成功！');

      // Trigger afterStop action hook
      await this.hookService.doAction('comment|afterStop', { pid }, { action: 'stop' });
    }
  }

  async restart(reason: string): Promise<void> {
    this.logger.log(`${reason}重启 Waline`);

    // Trigger beforeRestart action hook
    await this.hookService.doAction('comment|beforeRestart', { reason }, { action: 'restart' });

    if (this.walineProcess) {
      await this.stop();
    }
    await this.start();

    // Trigger afterRestart action hook
    await this.hookService.doAction('comment|afterRestart', { reason }, { action: 'restart' });
  }

  async init(): Promise<void> {
    await this.start();
  }

  getStatus(): { running: boolean; pid?: number } {
    return {
      running: this.walineProcess !== null,
      pid: this.walineProcess?.pid,
    };
  }
}
