import { DynamicModule, Global, Module, Provider } from '@nestjs/common';

import {
  PermissionCollectionService,
  contributePermissions,
} from './permission-collection.service';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';

// 共享的注入令牌
const PERMISSIONS = 'PERMISSIONS';

@Global() // 使权限服务在全局可用
@Module({})
export class PermissionModule {
  /**
   * 在根模块 (AppModule) 中调用一次。
   * 负责创建和导出权限收集服务。
   */
  static forRoot(): DynamicModule {
    return {
      module: PermissionModule,
      controllers: [PermissionController],
      providers: [PermissionCollectionService, PermissionService],
      exports: [PermissionCollectionService, PermissionService],
    };
  }

  /**
   * 在功能模块 (Feature Module) 中调用。
   * 负责接收该模块的权限列表，并将其作为 provider 注册。
   * 同时通过工厂 provider 主动将权限贡献给全局的 PermissionCollectionService，避免多 provider 注入时序问题。
   * @param permissions - 该功能模块提供的一组权限字符串。
   */
  static forFeature(permissions: string[]): DynamicModule {
    const permissionsProvider: Provider = {
      provide: PERMISSIONS,
      useValue: permissions,
    };

    const contributeProvider: Provider = {
      provide: 'PERMISSION_CONTRIBUTION',
      useFactory: (perms: string[]) => {
        contributePermissions(perms);
        return true;
      },
      inject: [PERMISSIONS],
    };

    return {
      module: PermissionModule,
      providers: [permissionsProvider, contributeProvider],
      exports: [permissionsProvider],
    };
  }
}

// 导出常量供 PermissionCollectionService 使用
export { PERMISSIONS };
