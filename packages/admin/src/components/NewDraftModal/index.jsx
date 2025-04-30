import { createDraft, getAllCategories, getTags } from '@/services/van-blog/api';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { Button } from 'antd';
import dayjs from '@/utils/dayjs';
import AuthorField from '../AuthorField';

const trans_zh = {
  'new_draft.modal.title': '新建草稿',
  'new_draft.button': '新建草稿',
  'new_draft.field.title': '文章标题',
  'new_draft.field.title.placeholder': '请输入标题',
  'new_draft.field.required': '这是必填项',
  'new_draft.field.tags': '标签',
  'new_draft.field.tags.placeholder': '请选择或输入标签',
  'new_draft.field.category': '分类',
  'new_draft.field.category.tooltip': '首次使用请先在站点管理-数据管理-分类管理中添加分类',
  'new_draft.field.category.placeholder': '请选择分类',
  'new_draft.field.created_at': '创建时间',
  'new_draft.field.created_at.placeholder': '不填默认为此刻',
};

export default function (props) {
  const { onFinish } = props;
  return (
    <ModalForm
      title={trans_zh['new_draft.modal.title']}
      trigger={
        <Button key="button" type="primary">
          {trans_zh['new_draft.button']}
        </Button>
      }
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      onFinish={async (values) => {
        const washedValues = {};
        for (const [k, v] of Object.entries(values)) {
          washedValues[k.replace('C', '')] = v;
        }

        const { data } = await createDraft(washedValues);
        if (onFinish) {
          onFinish(data);
        }
        return true;
      }}
      layout="horizontal"
      labelCol={{ span: 6 }}
      // wrapperCol: { span: 14 },
    >
      <ProFormText
        width="md"
        required
        id="titleC"
        name="titleC"
        label={trans_zh['new_draft.field.title']}
        placeholder={trans_zh['new_draft.field.title.placeholder']}
        rules={[{ required: true, message: trans_zh['new_draft.field.required'] }]}
      />
      <AuthorField />
      <ProFormSelect
        mode="tags"
        tokenSeparators={[',']}
        width="md"
        name="tagsC"
        label={trans_zh['new_draft.field.tags']}
        placeholder={trans_zh['new_draft.field.tags.placeholder']}
        request={async () => {
          const msg = await getTags();
          return msg?.data?.map((item) => ({ label: item, value: item })) || [];
        }}
      />
      <ProFormSelect
        width="md"
        required
        id="categoryC"
        name="categoryC"
        label={trans_zh['new_draft.field.category']}
        tooltip={trans_zh['new_draft.field.category.tooltip']}
        placeholder={trans_zh['new_draft.field.category.placeholder']}
        rules={[{ required: true, message: trans_zh['new_draft.field.required'] }]}
        request={async () => {
          const { data: categories } = await getAllCategories();
          return categories?.map((e) => {
            return {
              label: e,
              value: e,
            };
          });
        }}
      />
      <ProFormDateTimePicker
        width="md"
        name="createdAtC"
        id="createdAtC"
        label={trans_zh['new_draft.field.created_at']}
        placeholder={trans_zh['new_draft.field.created_at.placeholder']}
        showTime={{
          defaultValue: dayjs('00:00:00', 'HH:mm:ss'),
        }}
      />
    </ModalForm>
  );
}
