import { ModalForm, ProFormSelect } from '@ant-design/pro-form';
import { Alert, message } from 'antd';
import { ReactNode } from 'react';

const trans_zh = {
  'editor_profile.modal.title': '编辑器偏好设置',
  'editor_profile.alert.message': '此配置保存在浏览器存储中，切换设备需重新设置。',
  'editor_profile.save.success': '保存成功！',
  'editor_profile.field.after_save': '保存后行为',
  'editor_profile.field.after_save.placeholder': '请选择保存后行为，默认留在此页面',
  'editor_profile.after_save.stay': '留在此页',
  'editor_profile.after_save.back': '返回之前页面',
  'editor_profile.field.local_cache': '本地缓存',
  'editor_profile.field.local_cache.tooltip':
    '默认关闭，开启后将在本地缓存编辑器内容，当本地内容比服务器内容更新时间更近时，将使用本地内容展示在编辑器中。',
  'editor_profile.field.local_cache.placeholder': '是否开启本地缓存',
  'editor_profile.option.enabled': '开启',
  'editor_profile.option.disabled': '关闭',
};

interface EditorProfileProps {
  setValue: (value: Record<string, unknown>) => void;
  value: Record<string, unknown>;
  trigger: ReactNode;
}

export default function (props: EditorProfileProps) {
  const { setValue, value, trigger } = props;
  return (
    <ModalForm
      title={trans_zh['editor_profile.modal.title']}
      trigger={trigger}
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      initialValues={value || {}}
      onFinish={async (vals) => {
        setValue({ ...value, ...vals });
        message.success(trans_zh['editor_profile.save.success']);
        return true;
      }}
      layout="horizontal"
      labelCol={{ span: 6 }}
      key="editForm"
    >
      <Alert
        type="info"
        message={trans_zh['editor_profile.alert.message']}
        style={{ marginBottom: 8 }}
      ></Alert>

      <ProFormSelect
        width="md"
        required
        id="afterSave"
        name="afterSave"
        label={trans_zh['editor_profile.field.after_save']}
        placeholder={trans_zh['editor_profile.field.after_save.placeholder']}
        request={async () => {
          return [
            {
              label: trans_zh['editor_profile.after_save.stay'],
              value: 'stay',
            },
            {
              label: trans_zh['editor_profile.after_save.back'],
              value: 'goBack',
            },
          ];
        }}
      />

      <ProFormSelect
        width="md"
        required
        id="useLocalCache"
        name="useLocalCache"
        label={trans_zh['editor_profile.field.local_cache']}
        tooltip={trans_zh['editor_profile.field.local_cache.tooltip']}
        placeholder={trans_zh['editor_profile.field.local_cache.placeholder']}
        request={async () => {
          return [
            {
              label: trans_zh['editor_profile.option.enabled'],
              value: 'open',
            },
            {
              label: trans_zh['editor_profile.option.disabled'],
              value: 'close',
            },
          ];
        }}
      />
    </ModalForm>
  );
}
