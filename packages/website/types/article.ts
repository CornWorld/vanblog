export interface Article {
  id: number; // server-ng使用integer主键
  title: string;
  content: string;
  pathname?: string;
  tags: string[]; // server-ng中存储为JSON字符串，但API返回时解析为数组
  category?: string; // server-ng中可为null
  author: string; // server-ng新增字段
  top: number; // server-ng使用integer，默认0
  hidden: boolean; // server-ng字段名为hidden而不是hide
  private: boolean;
  password?: string; // server-ng新增字段
  viewer: number; // server-ng使用integer，默认0
  createdAt: string;
  updatedAt: string;

  // 兼容旧版本的字段（可选）
  date?: string; // 映射到createdAt
  hide?: boolean; // 映射到hidden
  secret?: boolean; // 映射到password存在性
  copyright?: string; // 可能在content中处理
  summary?: string; // 可能需要从content提取
  wordCount?: number; // 可能需要计算
}
