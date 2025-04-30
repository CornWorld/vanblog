import { ModalForm, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { Alert, Modal } from 'antd';

import { createCustomPage, updateCustomPage } from '@/services/van-blog/api';

const trans_zh = {
  'custompage.modal.edit': '修改自定义页面',
  'custompage.modal.new': '新建自定义页面',
  'custompage.demo.restricted': '演示站不可修改此项！',
  'custompage.path.error': '路径必须以斜杠为开头！',
  'custompage.alert.hint': '具体内容请在创建后在列表中点击对应操作按钮进行修改',
  'custompage.field.type': '类型',
  'custompage.field.type.tooltip':
    '单文件页面可直接通过后台内置编辑器编辑内容，比较方便；多文件页面需要上传相关文件，适合复杂场景。',
  'custompage.field.type.placeholder': '请选择类型',
  'custompage.type.single': '单文件页面',
  'custompage.type.multi': '多文件页面',
  'custompage.field.name': '名称',
  'custompage.field.name.placeholder': '请输入名称',
  'custompage.field.name.tooltip': '自定义页面的名称',
  'custompage.field.path': '路径',
  'custompage.field.path.placeholder': '自定义页面的路径',
  'custompage.field.path.tooltip': '自定义页面的路径，必须以斜杠开头，会加载到 /c 路径下。',
  'custompage.field.required': '这是必填项',
};

export default ({
  onFinish,
  trigger,
  initialValues,
}: {
  onFinish: () => void;
  // FIXME: Add types
  trigger: unknown;
  // FIXME: Add types
  initialValues?: unknown;
}) => (
  <ModalForm
    title={initialValues ? trans_zh['custompage.modal.edit'] : trans_zh['custompage.modal.new']}
    trigger={trigger}
    width={450}
    autoFocusFirstInput
    submitTimeout={3000}
    initialValues={initialValues}
    onFinish={async (values) => {
      // FIXME: Should be refactor in to an env variable controlling "A demo state"
      if (location.hostname === 'blog-demo.mereith.com') {
        Modal.info({
          title: trans_zh['custompage.demo.restricted'],
        });
        return;
      }

      const path = values.path as string;

      if (path.substring(0, 1) != '/') {
        Modal.info({
          title: trans_zh['custompage.path.error'],
        });
        return false;
      }

      if (initialValues) {
        await updateCustomPage({ ...values });
      } else {
        await createCustomPage(values);
      }

      if (onFinish) {
        onFinish();
      }

      return true;
    }}
    layout="horizontal"
    labelCol={{ span: 6 }}
  >
    {!initialValues && (
      <>
        <Alert
          style={{ marginBottom: 8 }}
          type="info"
          message={trans_zh['custompage.alert.hint']}
        />
        <ProFormSelect
          width="md"
          name="type"
          required
          tooltip={trans_zh['custompage.field.type.tooltip']}
          label={trans_zh['custompage.field.type']}
          placeholder={trans_zh['custompage.field.type.placeholder']}
          rules={[{ required: true, message: trans_zh['custompage.field.required'] }]}
          initialValue={'folder'}
          request={async () => {
            return [
              { label: trans_zh['custompage.type.single'], value: 'file' },
              { label: trans_zh['custompage.type.multi'], value: 'folder' },
            ];
          }}
        />
      </>
    )}
    <ProFormText
      width="md"
      required
      id="name"
      name="name"
      label={trans_zh['custompage.field.name']}
      placeholder={trans_zh['custompage.field.name.placeholder']}
      tooltip={trans_zh['custompage.field.name.tooltip']}
      rules={[{ required: true, message: trans_zh['custompage.field.required'] }]}
    />
    <ProFormText
      disabled={initialValues && initialValues.type == 'folder'}
      width="md"
      required
      id="path"
      name="path"
      label={trans_zh['custompage.field.path']}
      placeholder={trans_zh['custompage.field.path.placeholder']}
      tooltip={trans_zh['custompage.field.path.tooltip']}
      rules={[{ required: true, message: trans_zh['custompage.field.required'] }]}
    />
  </ModalForm>
);
