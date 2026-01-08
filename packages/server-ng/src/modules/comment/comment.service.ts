import { ChildProcess, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { connect as netConnect } from 'node:net';
import { resolve, dirname } from 'node:path';

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  BeforeApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { AllConfig } from '../../config/config.interface';
import { normalizeCommentOtherConfig } from '../../shared/contracts';
import { HookService } from '../plugin/services/hook.service';
import { SettingCoreService } from '../setting/services/setting-core.service';

import { UpdateWalineSetting, WalineSetting, UpdateWalineSettingSchema } from './comment.schema';

@Injectable()
export class CommentService implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown {
  private readonly logger = new Logger(CommentService.name);
  private walineProcess: ChildProcess | null = null;
  private walineEnv: Record<string, string> = {};

  constructor(
    private readonly settingService: SettingCoreService,
    private readonly hookService: HookService,
    private readonly configService: ConfigService<AllConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    // 测试环境下不自动启动 Waline（避免测试时意外创建子进程）
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return;
    }
    try {
      await this.start();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Waline 启动失败: ${msg}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.stop();
  }

  async getWalineSetting(): Promise<WalineSetting> {
    const defaultSetting: WalineSetting = {
      'smtp.enabled': false,
      'smtp.port': 587,
      'smtp.host': '',
      'smtp.user': '',
      'smtp.password': '',
      'sender.name': '',
      'sender.email': 'noreply@example.com',
      authorEmail: 'admin@example.com',
      webhook: '',
      forceLoginComment: false,
      otherConfig: '',
      serverURL: '',
    };

    const setting = await this.settingService.getConfig<WalineSetting>(
      'walineSetting',
      defaultSetting,
    );
    return setting ?? defaultSetting;
  }

  async updateWalineSetting(data: UpdateWalineSetting): Promise<WalineSetting> {
    const existing = await this.getWalineSetting();

    // Trigger comment|before_update filter hook
    const filteredData = await this.hookService.applyFilters('comment|beforeUpdate', data, {
      action: 'update',
      existing,
    });

    const parsed = UpdateWalineSettingSchema.partial().parse(filteredData);
    const updated = { ...existing, ...parsed };
    const result = await this.settingService.updateConfig('walineSetting', updated);

    // Restart Waline with new settings
    await this.restart('配置更新');

    // Trigger comment|afterUpdate action hook
    await this.hookService.doAction('comment|afterUpdate', result, {
      action: 'update',
      previous: existing,
      changes: filteredData,
    });

    return result;
  }

  // 新增：对外提供“已解析”的 Waline 配置，确保 serverURL 始终有值
  public async getResolvedWalineConfig(): Promise<{ serverURL?: string }> {
    // 若在设置中显式配置了 serverURL，则优先返回
    try {
      const settings = await this.getWalineSetting();
      const configured = (typeof settings.serverURL === 'string' ? settings.serverURL : '').trim();
      if (configured !== '') {
        return { serverURL: configured };
      }
    } catch {
      // ignore, fallback below
    }

    // 优先使用运行时环境合成的 URL，其次回退到 HOST/PORT 缺省值
    const rawEnvUrl = this.walineEnv['SERVER_URL'];

    if (typeof rawEnvUrl === 'string' && rawEnvUrl.trim() !== '') {
      return { serverURL: rawEnvUrl.trim() };
    }

    const rawHost = this.walineEnv['HOST'];
    const host =
      typeof rawHost === 'string' && rawHost.trim() !== '' ? rawHost.trim() : '127.0.0.1';
    const rawPort = this.walineEnv['PORT'];
    const port = typeof rawPort === 'string' && rawPort.trim() !== '' ? rawPort.trim() : '8360';
    return { serverURL: `http://${host}:${port}` };
  }

  public mapConfigToEnv(config: WalineSetting): Record<string, string> {
    const walineEnvMapping: Record<string, string> = {
      'smtp.port': 'SMTP_PORT',
      'smtp.host': 'SMTP_HOST',
      'smtp.user': 'SMTP_USER',
      'sender.name': 'SENDER_NAME',
      'sender.email': 'SENDER_EMAIL',
      'smtp.password': 'SMTP_PASS',
      'smtp.enabled': '', // Skip this field
      authorEmail: 'AUTHOR_EMAIL',
      webhook: 'WEBHOOK',
      forceLoginComment: 'LOGIN',
      serverURL: 'SERVER_URL',
    };

    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(config)) {
      if (key === 'forceLoginComment') {
        if (value === true) {
          result['LOGIN'] = 'force';
        }
      } else if (key === 'otherConfig') {
        if (config.otherConfig !== '') {
          // Use basic Zod record schema for validation
          const OtherConfigSchema = z.record(z.string(), z.unknown());
          const parsed = OtherConfigSchema.safeParse(
            typeof config.otherConfig === 'string'
              ? (() => {
                  try {
                    return JSON.parse(config.otherConfig);
                  } catch {
                    return {};
                  }
                })()
              : config.otherConfig,
          );

          if (parsed.success) {
            const otherConfig = normalizeCommentOtherConfig(parsed.data);
            for (const [k, v] of Object.entries(otherConfig)) {
              result[k] = v;
            }
          } else {
            this.logger.warn('Failed to parse otherConfig:', parsed.error);
          }
        }
      } else {
        const envKey = walineEnvMapping[key];
        if (envKey !== '') {
          result[envKey] = String(value);
        }
      }
    }

    // Remove SMTP related env vars if SMTP is disabled
    const smtpEnabled = config['smtp.enabled'];
    if (!smtpEnabled) {
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
    // 使用独立的 SQLite 数据库而非 Mongo
    const walineDb = this.configService.get<string>('waline.db', { infer: true }) ?? 'waline';

    // SQLite 配置（单独的存储路径，避免与主库共用）
    const sqlitePath = resolve(process.cwd(), './data/waline');
    await mkdir(sqlitePath, { recursive: true });
    const sqliteEnv: Record<string, string> = {
      SQLITE_PATH: sqlitePath,
      SQLITE_DB: walineDb,
      SQLITE_PREFIX: 'wl_',
    };

    // 站点信息
    const siteInfo = await this.settingService.getSiteInfo();
    const jwtSecret = this.configService.get<string>('jwt.secret', { infer: true }) ?? '';
    const otherEnv: Record<string, string> = {
      SITE_NAME: siteInfo.title,
      SITE_URL: 'http://localhost:3000',
      JWT_TOKEN: jwtSecret,
      HOST: '127.0.0.1', // Waline 监听地址 - 用于内部探测与拼接 URL
      PORT: '8360', // Waline 监听端口
    };

    // Waline 业务配置
    const walineConfig = await this.getWalineSetting();
    const walineConfigEnv = this.mapConfigToEnv(walineConfig);

    const mergedEnv: Record<string, string> = {
      ...sqliteEnv,
      ...otherEnv,
      ...walineConfigEnv,
    };

    const hasWalineUrl =
      typeof mergedEnv.SERVER_URL === 'string' && mergedEnv.SERVER_URL.trim().length > 0;

    if (!hasWalineUrl) {
      // Backward-compat: allow VAN_BLOG_WALINE_URL to override when SERVER_URL is not provided
      const compatUrl = process.env.VAN_BLOG_WALINE_URL;
      if (typeof compatUrl === 'string' && compatUrl.trim() !== '') {
        mergedEnv.SERVER_URL = compatUrl.trim();
      }
    }

    const currentServerUrl = typeof mergedEnv.SERVER_URL === 'string' ? mergedEnv.SERVER_URL : '';
    if (currentServerUrl.trim() === '') {
      const host =
        typeof mergedEnv.HOST === 'string' && mergedEnv.HOST.trim().length > 0
          ? mergedEnv.HOST.trim()
          : '127.0.0.1';
      const port =
        typeof mergedEnv.PORT === 'string' && mergedEnv.PORT.trim().length > 0
          ? mergedEnv.PORT.trim()
          : '8360';
      mergedEnv.SERVER_URL = `http://${host}:${port}`;
    }

    this.walineEnv = mergedEnv;

    // 安全日志：仅输出非敏感配置，避免泄露密钥
    const SENSITIVE_KEYS = /(PASS|PASSWORD|TOKEN|SECRET|MASTER_KEY|LEAN_KEY|LEAN_MASTER_KEY)/i;
    const safeEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.walineEnv)) {
      safeEnv[k] = SENSITIVE_KEYS.test(k) ? '<redacted>' : v;
    }
    this.logger.log(`Waline 配置(安全版): ${JSON.stringify(safeEnv, null, 2)}`);
  }

  // 计算 Waline 锁文件路径
  private getWalineLockPath(): string {
    const p = this.walineEnv.SQLITE_PATH;
    const base =
      typeof p === 'string' && p.trim() !== '' ? p : resolve(process.cwd(), './data/waline');
    return resolve(base, 'waline.lock');
  }

  // 获取跨进程锁。若存在且持有者仍在运行，则返回 false；若为陈旧锁则移除并获取。
  private async acquireWalineLock(): Promise<boolean> {
    const lockPath = this.getWalineLockPath();
    try {
      await mkdir(dirname(lockPath), { recursive: true });
      await writeFile(lockPath, String(process.pid), { flag: 'wx' });
      return true;
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === 'EEXIST') {
        try {
          const txt = await readFile(lockPath, 'utf8');
          const pid = Number.parseInt(txt.trim(), 10);
          if (Number.isFinite(pid) && pid > 0) {
            try {
              // 检查进程是否仍存在
              process.kill(pid, 0);
              // 仍在运行，放弃启动
              return false;
            } catch {
              // 进程不存在，视为陈旧锁，移除后重试创建
              await unlink(lockPath).catch(() => {});
              await writeFile(lockPath, String(process.pid), { flag: 'wx' });
              return true;
            }
          }
        } catch {
          // 无法读取/解析，移除并尝试获取
          await unlink(lockPath).catch(() => {});
          try {
            await writeFile(lockPath, String(process.pid), { flag: 'wx' });
            return true;
          } catch {
            return false;
          }
        }
      }
      return false;
    }
  }

  // 释放跨进程锁，仅在当前进程持有时删除
  private async releaseWalineLock(): Promise<void> {
    const lockPath = this.getWalineLockPath();
    try {
      const txt = await readFile(lockPath, 'utf8');
      if (txt.trim() === String(process.pid)) {
        await unlink(lockPath).catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  // 检查端口是否被占用（尝试连接）
  private async isPortInUse(host: string, port: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const socket = netConnect({ host, port });

      const finish = (val: boolean): void => {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      };

      socket.once('connect', () => {
        socket.end();
        finish(true); // 可连接，说明端口被占用
      });

      socket.once('error', (err: unknown) => {
        const e = err as NodeJS.ErrnoException | undefined;
        // ECONNREFUSED/ENOTFOUND 表示无人监听
        if (e && (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND')) {
          finish(false);
        } else {
          // 其它错误保守处理为被占用，避免继续启动导致冲突
          finish(true);
        }
      });

      // 超时保护
      setTimeout(() => {
        socket.destroy();
        finish(false);
      }, 800);
    });
  }

  async start(): Promise<void> {
    // Trigger beforeStart action hook
    await this.hookService.doAction('comment|beforeStart', {}, { action: 'start' });

    await this.loadEnv();

    // 使用文件锁避免并发重复启动
    const lockAcquired = await this.acquireWalineLock();
    if (!lockAcquired) {
      this.logger.log('检测到已有 Waline 实例在运行，跳过启动');
      return;
    }

    // 启动前检查端口占用，避免 EADDRINUSE
    const hostRaw = typeof this.walineEnv.HOST === 'string' ? this.walineEnv.HOST.trim() : '';
    const host = hostRaw === '' ? '127.0.0.1' : hostRaw;
    const portRaw = typeof this.walineEnv.PORT === 'string' ? this.walineEnv.PORT.trim() : '';
    const portStr = portRaw === '' ? '8360' : portRaw;
    const parsed = Number.parseInt(portStr, 10);
    const portNum = Number.isFinite(parsed) ? parsed : 8360;
    if (await this.isPortInUse(host, portNum)) {
      this.logger.warn(`检测到端口已被占用(${host}:${String(portNum)})，跳过启动 Waline`);
      await this.releaseWalineLock();
      return;
    }

    if (this.walineProcess === null) {
      const walinePath = '../waline/node_modules/@waline/vercel/vanilla.js';

      this.walineProcess = spawn('node', [walinePath], {
        env: {
          ...process.env,
          ...this.walineEnv,
        },
        cwd: process.cwd(),
      });

      const child = this.walineProcess;

      child.on('message', (message: unknown) => {
        const output = typeof message === 'string' ? message : JSON.stringify(message);
        this.logger.log(output);
      });

      child.on('error', (error: Error) => {
        this.logger.error(`Waline 进程错误: ${error.message}`);
        void this.releaseWalineLock();
      });

      child.on('exit', () => {
        this.walineProcess = null;
        this.logger.warn('Waline 进程退出');
        // 释放锁
        void this.releaseWalineLock();
        // Trigger process exit hook
        void this.hookService.doAction('comment|processExit', {}, { action: 'exit' });
      });

      if (child.stdout) {
        child.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          if (!output.includes('Cannot find module')) {
            this.logger.log(output.substring(0, output.length - 1));
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          this.logger.error(output.substring(0, output.length - 1));
        });
      }

      this.logger.log('Waline 启动成功！');

      // Trigger afterStart action hook
      await this.hookService.doAction(
        'comment|afterStart',
        {
          pid: child.pid,
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
      const child = this.walineProcess;
      const { pid } = child;

      // Trigger beforeStop action hook
      await this.hookService.doAction('comment|beforeStop', { pid }, { action: 'stop' });

      try {
        // 先尝试优雅关闭
        child.kill('SIGTERM');

        // 等待一段时间后强制终止
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (child.pid) {
              child.kill('SIGKILL');
            }
            resolve();
          }, 3000);

          child.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`停止 Waline 进程时出错: ${errorMessage}`);
      }

      this.walineProcess = null;
      this.logger.log('Waline 停止成功！');

      // Trigger afterStop action hook
      await this.hookService.doAction('comment|afterStop', { pid }, { action: 'stop' });
    }

    // 释放锁（若当前进程持有）
    await this.releaseWalineLock();
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

  getStatus(): { running: boolean; pid?: number } {
    const child = this.walineProcess;
    const running = child !== null;
    const pid = child ? child.pid : undefined;
    return { running, pid };
  }
}
