/**
 * @file shortcode.module.ts
 *
 * Shortcode 模块
 *
 * 提供 WordPress 风格的 shortcode 处理功能
 */

import { Global, Module } from '@nestjs/common';

import { ShortcodeService } from './shortcode.service';

@Global()
@Module({
  providers: [ShortcodeService],
  exports: [ShortcodeService],
})
export class ShortcodeModule {}
