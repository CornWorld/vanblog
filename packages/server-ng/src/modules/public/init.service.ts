import { ConflictException, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { SettingCoreService } from '../setting/services/setting-core.service';
import { CreateUserSchema, UserType } from '../user/dto/create-user.dto';
import { UserService } from '../user/user.service';

import { InitCmsRequestSchema, InitCmsResponseSchema } from './dto/init.dto';

@Injectable()
export class InitService {
  constructor(
    private readonly userService: UserService,
    private readonly settingCoreService: SettingCoreService,
  ) {}

  async initializeCms(
    payload: z.infer<typeof InitCmsRequestSchema>,
  ): Promise<z.infer<typeof InitCmsResponseSchema>> {
    // If admin already exists, block initialization
    const existingAdmin = await this.userService.getAdminUser();
    if (existingAdmin) {
      throw new ConflictException('CMS is already initialized');
    }

    // Create admin user with enforced type 'admin' and normalized permissions via Zod schema
    const adminInput = {
      username: payload.admin.username,
      password: payload.admin.password,
      ...(payload.admin.nickname ? { nickname: payload.admin.nickname } : {}),
      ...(payload.admin.email ? { email: payload.admin.email } : {}),
      ...(payload.admin.avatar ? { avatar: payload.admin.avatar } : {}),
      permissions: ['role:admin'],
      type: UserType.ADMIN,
    };
    const normalizedAdmin = CreateUserSchema.parse(adminInput);

    const adminUser = await this.userService.create(normalizedAdmin);

    // Optionally update site info
    let updatedSiteInfo:
      | Awaited<ReturnType<typeof this.settingCoreService.getSiteInfo>>
      | undefined;
    if (payload.siteInfo) {
      updatedSiteInfo = await this.settingCoreService.updateSiteInfo(payload.siteInfo);
    }

    return {
      initialized: true,
      admin: { id: adminUser.id, username: adminUser.username },
      ...(updatedSiteInfo ? { siteInfo: updatedSiteInfo } : {}),
    };
  }
}
