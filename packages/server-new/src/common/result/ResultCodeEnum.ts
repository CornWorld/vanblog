// 定义结果代码枚举
export enum ResultCodeEnum {
  SUCCESS = 200,
  FAIL = 201,
  LOGIN_ERROR = 205,
  LOGIN_AUTH = 208,
  PERMISSION = 209,
}

// 获取枚举对应的消息
export const ResultCodeMessage: Record<ResultCodeEnum, string> = {
  [ResultCodeEnum.SUCCESS]: '成功',
  [ResultCodeEnum.FAIL]: '失败',
  [ResultCodeEnum.LOGIN_ERROR]: '认证失败',
  [ResultCodeEnum.LOGIN_AUTH]: '未登陆',
  [ResultCodeEnum.PERMISSION]: '没有权限',
};
