/**
 * @description 结果代码枚举定义
 */
export enum ResultCodeEnum {
  SUCCESS = 200,
  FAIL = 500,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
}

/**
 * @description 枚举对应的消息
 */
export const ResultCodeMessage: Record<ResultCodeEnum, string> = {
  [ResultCodeEnum.SUCCESS]: '成功',
  [ResultCodeEnum.FAIL]: '服务器异常',
  [ResultCodeEnum.BAD_REQUEST]: '请求参数异常',
  [ResultCodeEnum.UNAUTHORIZED]: '认证失败',
  [ResultCodeEnum.FORBIDDEN]: '权限不足',
  [ResultCodeEnum.NOT_FOUND]: '没有找到该资源',
};
