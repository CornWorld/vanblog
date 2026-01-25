import React, { useState, useEffect } from 'react';
import {
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  message,
  Spin,
  Alert,
} from 'antd';
import { ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import type { PluginConfig, PluginConfigField } from '@vanblog/shared/plugin';

const { Panel } = Collapse;

interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  loaded: boolean;
}

interface PluginListResponse {
  plugins: PluginInfo[];
  total: number;
}

export default function PluginTab() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [expandedPlugins, setExpandedPlugins] = useState<string[]>([]);

  // 加载插件列表
  const loadPlugins = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v2/admin/plugins', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to load plugins: ${response.statusText}`);
      }
      const data: PluginListResponse = await response.json();
      setPlugins(data.plugins);
    } catch (error) {
      message.error(`加载插件列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 重新加载所有插件
  const reloadAllPlugins = async () => {
    setReloading(true);
    try {
      const response = await fetch('/api/v2/admin/plugins/reload', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to reload plugins: ${response.statusText}`);
      }
      const data = await response.json();
      message.success(`成功重新加载 ${data.loadedCount} 个插件`);
      await loadPlugins();
    } catch (error) {
      message.error(`重新加载插件失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setReloading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  return (
    <div>
      <Alert
        message="插件管理"
        description="管理和配置 VanBlog 插件。修改配置后会立即生效，无需重启服务。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card
        title="已加载插件"
        extra={
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={reloadAllPlugins}
            loading={reloading}
          >
            重新加载所有插件
          </Button>
        }
      >
        <Spin spinning={loading}>
          {plugins.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              暂无已加载的插件
            </div>
          ) : (
            <Collapse
              activeKey={expandedPlugins}
              onChange={(keys) => setExpandedPlugins(keys as string[])}
            >
              {plugins.map((plugin) => (
                <Panel
                  header={
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{plugin.name}</strong>
                        <span style={{ marginLeft: 8, color: '#999' }}>v{plugin.version}</span>
                      </div>
                      {plugin.description && (
                        <span style={{ color: '#666', fontSize: '14px' }}>
                          {plugin.description}
                        </span>
                      )}
                    </div>
                  }
                  key={plugin.name}
                  extra={<SettingOutlined />}
                >
                  <PluginConfigForm pluginName={plugin.name} />
                </Panel>
              ))}
            </Collapse>
          )}
        </Spin>
      </Card>
    </div>
  );
}

// 插件配置表单组件
function PluginConfigForm({ pluginName }: { pluginName: string }) {
  const [form] = Form.useForm();
  const [schema, setSchema] = useState<PluginConfig | null>(null);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 加载插件配置 schema 和当前值
  const loadConfig = async () => {
    setLoading(true);
    try {
      // 加载 schema
      const schemaResponse = await fetch(`/api/v2/admin/plugins/${pluginName}/config/schema`, {
        credentials: 'include',
      });

      if (schemaResponse.status === 404) {
        // 插件没有配置 schema
        setSchema(null);
        setConfig({});
        return;
      }

      if (!schemaResponse.ok) {
        throw new Error(`Failed to load config schema: ${schemaResponse.statusText}`);
      }
      const schemaData: PluginConfig = await schemaResponse.json();
      setSchema(schemaData);

      // 加载当前配置
      const configResponse = await fetch(`/api/v2/admin/plugins/${pluginName}/config`, {
        credentials: 'include',
      });
      if (!configResponse.ok) {
        throw new Error(`Failed to load config: ${configResponse.statusText}`);
      }
      const configData: Record<string, unknown> = await configResponse.json();
      setConfig(configData);
      form.setFieldsValue(configData);
    } catch (error) {
      message.error(`加载配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const saveConfig = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/v2/admin/plugins/${pluginName}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Failed to save config: ${response.statusText}`);
      }

      message.success('配置保存成功');
      setConfig(values);
    } catch (error) {
      message.error(`保存配置失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginName]);

  if (loading) {
    return <Spin />;
  }

  if (!schema || Object.keys(schema).length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0', color: '#999' }}>
        该插件没有可配置的选项
      </div>
    );
  }

  return (
    <Form form={form} layout="vertical" onFinish={saveConfig} initialValues={config}>
      {Object.entries(schema).map(([key, field]) => (
        <Form.Item
          key={key}
          name={key}
          label={field.title || key}
          help={field.description}
          valuePropName={field.type === 'boolean' ? 'checked' : 'value'}
        >
          {renderFormField(field)}
        </Form.Item>
      ))}
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>
          保存配置
        </Button>
        <Button style={{ marginLeft: 8 }} onClick={() => form.resetFields()}>
          重置
        </Button>
      </Form.Item>
    </Form>
  );
}

// 根据字段类型渲染表单控件
function renderFormField(field: PluginConfigField): React.ReactNode {
  switch (field.type) {
    case 'boolean':
      return <Switch />;

    case 'number':
      return (
        <InputNumber
          style={{ width: '100%' }}
          min={field.minimum}
          max={field.maximum}
          placeholder={`默认: ${field.default ?? ''}`}
        />
      );

    case 'string':
      if (field.enum && field.enum.length > 0) {
        return (
          <Select placeholder={`默认: ${field.default ?? ''}`}>
            {field.enum.map((option) => (
              <Select.Option key={String(option)} value={option}>
                {String(option)}
              </Select.Option>
            ))}
          </Select>
        );
      }
      return <Input placeholder={`默认: ${field.default ?? ''}`} />;

    case 'array':
      return (
        <Input.TextArea
          rows={4}
          placeholder={`输入 JSON 数组，例如: ${JSON.stringify(field.default || [])}`}
        />
      );

    case 'object':
      return (
        <Input.TextArea
          rows={6}
          placeholder={`输入 JSON 对象，例如: ${JSON.stringify(field.default || {}, null, 2)}`}
        />
      );

    default:
      return <Input />;
  }
}
