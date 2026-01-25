import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { HelmetOptions } from 'helmet';

/**
 * 安全配置接口
 */
export interface SecurityConfig {
  cors: CorsOptions;
  helmet: HelmetOptions;
  csrf: {
    enabled: boolean;
    cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'strict' | 'lax' | 'none';
    };
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
}

/**
 * 获取生产环境安全配置
 */
export function getProductionSecurityConfig(corsOrigin: string | string[]): SecurityConfig {
  return {
    cors: {
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400, // 24 hours
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // 避免与某些第三方服务冲突
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    },
    csrf: {
      enabled: true,
      cookieOptions: {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
      },
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 每个 IP 每 15 分钟最多 100 个请求
      skipSuccessfulRequests: false,
    },
  };
}

/**
 * 获取开发环境安全配置
 */
export function getDevelopmentSecurityConfig(corsOrigin: string | string[]): SecurityConfig {
  return {
    cors: {
      origin: corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // 开发环境允许 eval
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    },
    csrf: {
      enabled: false, // 开发环境禁用 CSRF
      cookieOptions: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      },
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 1000, // 开发环境更宽松的限制
      skipSuccessfulRequests: true,
    },
  };
}

/**
 * CORS 源验证结果接口
 */
export interface CorsValidationResult {
  errors: string[];
  warnings: string[];
}

/**
 * 验证 CORS 源配置
 *
 * 检查 CORS 源配置的安全性，包括：
 * - 生产环境不允许使用通配符 "*"
 * - 验证 URL 格式的有效性
 * - 检查生产环境中的 HTTP 协议使用（建议使用 HTTPS）
 *
 * @param origin - CORS 源配置（字符串或字符串数组）
 * @param isProduction - 是否为生产环境
 * @returns 验证结果，包含错误和警告信息
 */
export function validateCorsOrigin(
  origin: string | string[],
  isProduction: boolean,
): CorsValidationResult {
  const result: CorsValidationResult = {
    errors: [],
    warnings: [],
  };

  // 生产环境不允许通配符
  if (isProduction && origin === '*') {
    result.errors.push('CRITICAL: CORS origin cannot be "*" in production environment');
    return result;
  }

  const origins = Array.isArray(origin) ? origin : [origin];

  for (const singleOrigin of origins) {
    // 跳过通配符（非生产环境允许）
    if (singleOrigin === '*') {
      if (isProduction) {
        result.errors.push('CRITICAL: Wildcard CORS origin is not allowed in production');
      }
      continue;
    }

    // 验证 URL 格式
    try {
      new URL(singleOrigin);
    } catch {
      result.errors.push(`Invalid CORS origin URL: ${singleOrigin}`);
    }

    // 检查生产环境中的 HTTP 协议使用
    if (isProduction && singleOrigin.startsWith('http://')) {
      result.warnings.push(`HTTP origin not recommended in production: ${singleOrigin}`);
    }
  }

  return result;
}
