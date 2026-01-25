import { useState, useEffect } from 'react';

/**
 * 插件数据结构
 */
interface PluginData {
  version: string;
  data: unknown;
}

/**
 * Bootstrap 响应中的插件扩展数据
 */
interface BootstrapExtensions {
  [pluginName: string]: PluginData;
}

/**
 * Bootstrap API 响应
 */
interface BootstrapResponse {
  statusCode: number;
  data: {
    version: string;
    extensions?: BootstrapExtensions;
    [key: string]: unknown;
  };
}

/**
 * Hook 返回类型
 */
interface UsePluginDataResult<T = unknown> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * 从 Bootstrap API 获取插件数据
 *
 * @param pluginName - 插件名称
 * @returns 插件数据、加载状态和错误信息
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data, loading, error } = usePluginData('rewards');
 *
 *   if (loading) return <div>加载中...</div>;
 *   if (error) return <div>错误: {error.message}</div>;
 *   if (!data) return <div>暂无数据</div>;
 *
 *   return <div>{JSON.stringify(data)}</div>;
 * }
 * ```
 */
export function usePluginData<T = unknown>(pluginName: string): UsePluginDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v2/public/bootstrap', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bootstrap: ${response.statusText}`);
      }

      const result: BootstrapResponse = await response.json();
      const extensions = result.data.extensions || {};
      const pluginData = extensions[pluginName];

      if (pluginData) {
        setData(pluginData.data as T);
      } else {
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginName]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * 获取所有插件数据
 *
 * @returns 所有插件数据、加载状态和错误信息
 *
 * @example
 * ```tsx
 * function PluginList() {
 *   const { data, loading } = useAllPluginData();
 *
 *   if (loading) return <div>加载中...</div>;
 *
 *   return (
 *     <ul>
 *       {Object.entries(data || {}).map(([name, pluginData]) => (
 *         <li key={name}>{name}: {JSON.stringify(pluginData.data)}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAllPluginData(): UsePluginDataResult<BootstrapExtensions> {
  const [data, setData] = useState<BootstrapExtensions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v2/public/bootstrap', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bootstrap: ${response.statusText}`);
      }

      const result: BootstrapResponse = await response.json();
      setData(result.data.extensions || {});
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
