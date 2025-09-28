import * as fs from 'fs';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { SettingRegistryService } from '../setting/services/setting-registry.service';

import type { HttpsSettings } from './caddy.schema';

@Injectable()
export class CaddyService implements OnModuleInit {
  private readonly logger = new Logger(CaddyService.name);
  private readonly caddyApiClient: AxiosInstance;
  private readonly subjects: string[] = [];

  constructor(private readonly settingRegistry: SettingRegistryService) {
    this.caddyApiClient = axios.create({
      baseURL: 'http://127.0.0.1:2019',
      timeout: 5000,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.init();
  }

  private async init(): Promise<void> {
    try {
      const httpsSettings = await this.getHttpsSettings();
      let message = '初始化 Caddy 配置完成！';

      if (httpsSettings?.redirect) {
        await this.setRedirect(true);
        message += ' HTTPS 自动重定向已开启';
      } else {
        await this.setRedirect(false);
        message += ' HTTPS 自动重定向已关闭';
      }

      this.logger.log(message);
    } catch (error) {
      this.logger.error('Caddy 初始化失败', error);
    }
  }

  /**
   * 获取 HTTPS 设置
   */
  async getHttpsSettings(): Promise<HttpsSettings | null> {
    try {
      return await this.settingRegistry.getConfig<HttpsSettings>('caddy.https');
    } catch (error) {
      this.logger.error('获取 HTTPS 设置失败', error);
      return null;
    }
  }

  /**
   * 更新 HTTPS 设置
   */
  async updateHttpsSettings(settings: HttpsSettings): Promise<HttpsSettings> {
    await this.settingRegistry.updateConfig('caddy.https', settings);

    // 应用重定向设置
    await this.setRedirect(settings.redirect);

    // 应用域名设置
    if (settings.domains.length > 0) {
      await this.updateHttpsDomains(settings.domains);
    }

    return settings;
  }

  /**
   * 设置 HTTPS 重定向
   */
  async setRedirect(redirect: boolean): Promise<string | false> {
    try {
      if (!redirect) {
        await this.caddyApiClient.delete('/config/apps/http/servers/srv1/listener_wrappers');
        this.logger.log('HTTPS 自动重定向已关闭');
        return '关闭成功！';
      } else {
        await this.caddyApiClient.post('/config/apps/http/servers/srv1/listener_wrappers', [
          {
            wrapper: 'http_redirect',
          },
        ]);
        this.logger.log('HTTPS 自动重定向已开启');
        return '开启成功！';
      }
    } catch (error) {
      this.logger.error(`${redirect ? '开启' : '关闭'} HTTPS 自动重定向失败`, error);
      return false;
    }
  }

  /**
   * 添加域名到证书管理
   */
  async addSubject(domain: string): Promise<void> {
    if (!this.subjects.includes(domain)) {
      this.subjects.push(domain);
      await this.updateSubjects(this.subjects);
    }
  }

  /**
   * 获取当前管理的域名列表
   */
  async getSubjects(): Promise<string[] | null> {
    try {
      const response = await this.caddyApiClient.get(
        '/config/apps/tls/automation/policies/subjects',
      );
      return response.data as string[];
    } catch (error) {
      this.logger.error('获取域名列表失败，通过 IP 进行 HTTPS 访问可能受限', error);
      return null;
    }
  }

  /**
   * 获取自动管理的域名
   */
  async getAutomaticDomains(): Promise<string[] | null> {
    try {
      const response = await this.caddyApiClient.get('/config/apps/tls/certificates/automate');
      return response.data as string[];
    } catch (error) {
      this.logger.error('获取自动域名失败', error);
      return null;
    }
  }

  /**
   * 更新域名列表
   */
  async updateSubjects(domains: string[]): Promise<boolean> {
    try {
      const response = await this.caddyApiClient.patch(
        '/config/apps/tls/automation/policies/0/subjects',
        domains,
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('更新域名列表失败', error);
      return false;
    }
  }

  /**
   * 应用 HTTPS 域名变更
   */
  async applyHttpsChange(domains: string[]): Promise<boolean> {
    return await this.updateHttpsDomains([...domains, ...this.subjects]);
  }

  /**
   * 更新 HTTPS 域名
   */
  async updateHttpsDomains(domains: string[]): Promise<boolean> {
    try {
      const response = await this.caddyApiClient.patch(
        '/config/apps/tls/certificates/automate',
        domains,
      );
      return response.status === 200;
    } catch (error) {
      this.logger.error('更新 HTTPS 域名失败', error);
      return false;
    }
  }

  /**
   * 获取 Caddy 配置
   */
  async getConfig(): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.caddyApiClient.get('/config');
      return response.data as Record<string, unknown>;
    } catch (error) {
      this.logger.error('获取 Caddy 配置失败', error);
      return null;
    }
  }

  /**
   * 获取 Caddy 日志
   */
  async getLog(): Promise<string> {
    return new Promise((resolve) => {
      try {
        const data = fs.readFileSync('/var/log/caddy.log', { encoding: 'utf-8' });
        resolve(data.toString());
      } catch (error) {
        this.logger.error('读取 Caddy 日志失败', error);
        resolve('');
      }
    });
  }

  /**
   * 清空 Caddy 日志
   */
  clearLog(): void {
    try {
      fs.writeFileSync('/var/log/caddy.log', '');
      this.logger.log('Caddy 日志已清空');
    } catch (error) {
      this.logger.error('清空 Caddy 日志失败', error);
    }
  }
}
