/**
 * SSRF 保护工具
 *
 * 提供 URL 验证功能，防止服务器端请求伪造（SSRF）攻击。
 * 检测并阻止对内部网络、本地主机、云元数据端点和其他内部资源的请求。
 *
 * @module url-validator.util
 */

/**
 * 被阻止的 IP 范围列表
 *
 * 包含所有不应被 webhook 访问的私有 IP 地址范围和特殊地址。
 * 使用 CIDR 表示法或单个 IP 地址。
 */
export const BLOCKED_IP_RANGES = [
  // IPv4 私有地址和特殊地址
  '127.0.0.0/8', // 本地回环地址
  '10.0.0.0/8', // 私有 Class A 网络
  '172.16.0.0/12', // 私有 Class B 网络
  '192.168.0.0/16', // 私有 Class C 网络
  '169.254.0.0/16', // 链路本地地址
  '169.254.169.254/32', // 云元数据服务端点（AWS/Azure/GCP）
  '0.0.0.0/8', // 当前网络地址

  // IPv6 私有地址和特殊地址
  '::1/128', // IPv6 本地回环地址
  'fc00::/7', // IPv6 唯一本地地址（私有）
  'fe80::/10', // IPv6 链路本地地址
  'ff00::/8', // IPv6 多播地址
] as const;

/**
 * 被阻止的协议列表
 *
 * 包含所有不应被 webhook 使用的危险协议。
 */
const BLOCKED_PROTOCOLS = [
  'file:',
  'ftp:',
  'javascript:',
  'data:',
  'mailto:',
  'ws:',
  'wss:',
] as const;

/**
 * IP 地址范围接口
 *
 * 表示一个 IP 地址范围，用于检查 IP 是否在范围内。
 */
interface IPRange {
  start: bigint;
  end: bigint;
  cidr: string;
}

/**
 * 将 IPv4 地址转换为 bigint
 *
 * @param ip - IPv4 地址字符串
 * @returns bigint 表示的 IP 地址
 */
function ipv4ToBigInt(ip: string): bigint {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }

  let result = 0n;
  for (let i = 0; i < 4; i++) {
    const part = Number.parseInt(parts[i] ?? '', 10);
    if (Number.isNaN(part) || part < 0 || part > 255) {
      throw new Error(`Invalid IPv4 address: ${ip}`);
    }
    result = (result << 8n) + BigInt(part);
  }

  return result;
}

/**
 * 将 IPv6 地址转换为 bigint
 *
 * @param ip - IPv6 地址字符串
 * @returns bigint 表示的 IP 地址
 */
function ipv6ToBigInt(ip: string): bigint {
  // 处理 :: 省略
  const parts = ip.split(':');
  if (parts.length < 3 || parts.length > 8) {
    throw new Error(`Invalid IPv6 address: ${ip}`);
  }

  // 展开省略的 :: 部分
  const emptyIndex = parts.indexOf('');
  if (emptyIndex !== -1) {
    const missing = 8 - parts.length;
    const newParts = [...parts];

    const filledParts = Array<string>(missing + 1).fill('0');
    newParts.splice(emptyIndex, 1, ...filledParts);
    return ipv6ToBigInt(newParts.join(':'));
  }

  let result = 0n;
  for (const part of parts) {
    const value = Number.parseInt(part || '0', 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff) {
      throw new Error(`Invalid IPv6 address: ${ip}`);
    }
    result = (result << 16n) + BigInt(value);
  }

  return result;
}

/**
 * 解析 CIDR 表示法为 IP 范围
 *
 * @param cidr - CIDR 字符串（例如：192.168.0.0/16）
 * @returns IP 范围对象
 */
function parseCIDR(cidr: string): IPRange {
  const parts = cidr.split('/');
  if (parts.length !== 2) {
    throw new Error(`Invalid CIDR: ${cidr}`);
  }

  const [ipStr, prefixStr] = parts;

  const prefixLength = Number.parseInt(prefixStr, 10);

  if (!ipStr) {
    throw new Error(`Invalid CIDR: ${cidr}`);
  }

  if (ipStr.includes('.')) {
    // IPv4
    const ip = ipv4ToBigInt(ipStr);
    const mask = prefixLength === 0 ? 0n : (0xffffffffn << BigInt(32 - prefixLength)) & 0xffffffffn;
    const start = ip & mask;
    const end = start | (~mask & 0xffffffffn);

    return { start, end, cidr };
  } else {
    // IPv6
    const ip = ipv6ToBigInt(ipStr);
    const mask =
      prefixLength === 0
        ? 0n
        : (0xffffffffffffffffffffffffffffffffn << BigInt(128 - prefixLength)) &
          0xffffffffffffffffffffffffffffffffn;
    const start = ip & mask;
    const end = start | (~mask & 0xffffffffffffffffffffffffffffffffn);

    return { start, end, cidr };
  }
}

/**
 * 解析后的 IP 范围缓存
 */
let parsedRanges: IPRange[] | null = null;

/**
 * 获取解析后的 IP 范围列表
 *
 * 使用缓存避免重复解析。
 *
 * @returns 解析后的 IP 范围列表
 */
function getParsedRanges(): IPRange[] {
  if (parsedRanges === null) {
    parsedRanges = BLOCKED_IP_RANGES.map((cidr) => parseCIDR(cidr));
  }
  return parsedRanges;
}

/**
 * 检查 IP 地址是否为私有地址或在被阻止的范围内
 *
 * 支持 IPv4 和 IPv6 地址。
 *
 * @param ip - IP 地址字符串
 * @returns 如果 IP 在被阻止的范围内返回 true，否则返回 false
 */
export function isPrivateIP(ip: string): boolean {
  try {
    const ranges = getParsedRanges();

    // 判断是 IPv4 还是 IPv6
    const isIPv4 = ip.includes('.');
    const ipBigInt = isIPv4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip);

    // 检查是否在任何被阻止的范围内
    for (const range of ranges) {
      if (isIPv4 && range.cidr.includes(':')) {
        // IPv4 地址不应该与 IPv6 范围比较
        continue;
      }
      if (!isIPv4 && !range.cidr.includes(':')) {
        // IPv6 地址不应该与 IPv4 范围比较
        continue;
      }

      if (ipBigInt >= range.start && ipBigInt <= range.end) {
        return true;
      }
    }

    return false;
  } catch (_error) {
    // 如果解析失败，保守地返回 true 以阻止访问
    return true;
  }
}

/**
 * 检查 URL 是否使用被阻止的协议
 *
 * @param url - URL 对象
 * @returns 如果协议被阻止返回 true，否则返回 false
 */
export function isBlockedProtocol(url: URL): boolean {
  return BLOCKED_PROTOCOLS.some((protocol) => url.protocol === protocol);
}

/**
 * Webhook URL 验证结果接口
 */
export interface WebhookUrlValidationResult {
  /** URL 是否有效 */
  valid: boolean;
  /** 错误信息（如果验证失败） */
  error?: string;
  /** 被阻止的原因（用于调试） */
  reason?: 'INVALID_URL' | 'BLOCKED_PROTOCOL' | 'PRIVATE_IP' | 'BLOCKED_HOSTNAME';
}

/**
 * 验证 Webhook URL 是否安全
 *
 * 检查 URL 是否指向内部服务、私有网络或其他被阻止的资源。
 * 这是防止 SSRF 攻击的主要验证函数。
 *
 * @param urlString - 要验证的 URL 字符串
 * @returns 验证结果对象，包含是否有效和错误信息
 *
 * @example
 * ```ts
 * const result1 = validateWebhookUrl('https://example.com/webhook');
 * // { valid: true }
 *
 * const result2 = validateWebhookUrl('http://localhost:8080/webhook');
 * // { valid: false, error: 'Localhost addresses are not allowed', reason: 'PRIVATE_IP' }
 *
 * const result3 = validateWebhookUrl('http://192.168.1.1/webhook');
 * // { valid: false, error: 'Private IP addresses are not allowed', reason: 'PRIVATE_IP' }
 * ```
 */
export function validateWebhookUrl(urlString: string): WebhookUrlValidationResult {
  try {
    // 1. 解析 URL
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
        reason: 'INVALID_URL',
      };
    }

    // 2. 检查协议是否被允许（仅允许 http 和 https）
    if (isBlockedProtocol(url)) {
      return {
        valid: false,
        error: `Protocol "${url.protocol}" is not allowed. Only HTTP and HTTPS are allowed.`,
        reason: 'BLOCKED_PROTOCOL',
      };
    }

    // 3. 检查是否为 http 或 https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        valid: false,
        error: `Protocol "${url.protocol}" is not allowed. Only HTTP and HTTPS are allowed.`,
        reason: 'BLOCKED_PROTOCOL',
      };
    }

    // 4. 检查主机名是否为 localhost
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === 'localhost.localdomain' ||
      hostname.endsWith('.localhost')
    ) {
      return {
        valid: false,
        error: 'Localhost addresses are not allowed for webhooks',
        reason: 'BLOCKED_HOSTNAME',
      };
    }

    // 5. 检查主机名是否为 IP 地址
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    const isIPv6 = hostname.includes(':');

    if (isIPv4 || isIPv6) {
      // 如果是 IP 地址，检查是否为私有 IP
      if (isPrivateIP(hostname)) {
        return {
          valid: false,
          error: 'Private IP addresses are not allowed for webhooks',
          reason: 'PRIVATE_IP',
        };
      }
    }

    // 6. 检查主机名是否解析到私有 IP（DNS 重绑定攻击防护）
    // 注意：此检查在运行时进行，不在验证阶段进行 DNS 查询
    // 这是因为 DNS 解析可能很慢，且可能在不同的时间产生不同的结果
    // 实际的 DNS 检查在 webhook 执行时进行

    return { valid: true };
  } catch (_error) {
    return {
      valid: false,
      error: 'Failed to validate URL',
      reason: 'INVALID_URL',
    };
  }
}
