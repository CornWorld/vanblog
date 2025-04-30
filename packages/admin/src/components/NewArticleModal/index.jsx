import { createArticle, getAllCategories, getTags } from '@/services/van-blog/api';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { Button, Modal } from 'antd';
import dayjs from '@/utils/dayjs';
import AuthorField from '../AuthorField';

const trans_zh = {
  'new_article.title': '新建文章',
  'new_article.button': '新建文章',
  'new_article.modal.demo.title': '演示站禁止新建文章！',
  'new_article.modal.demo.content':
    '本来是可以的，但有个人在演示站首页放黄色信息，所以关了这个权限了。',
  'new_article.field.title': '文章标题',
  'new_article.field.title.placeholder': '请输入标题',
  'new_article.field.required': '这是必填项',
  'new_article.field.top': '置顶优先级',
  'new_article.field.top.placeholder': '留空或0表示不置顶，其余数字越大表示优先级越高',
  'new_article.field.pathname': '自定义路径名',
  'new_article.field.pathname.tooltip':
    '文章发布后的路径将为 /post/[自定义路径名]，如果未设置则使用文章 id 作为路径名',
  'new_article.field.pathname.placeholder': '留空或为空则使用 id 作为路径名',
  'new_article.field.tags': '标签',
  'new_article.field.tags.placeholder': '请选择或输入标签',
  'new_article.field.category': '分类',
  'new_article.field.category.tooltip': '首次使用请先在站点管理-数据管理-分类管理中添加分类',
  'new_article.field.category.placeholder': '请选择分类',
  'new_article.field.created_at': '创建时间',
  'new_article.field.created_at.placeholder': '不填默认为此刻',
  'new_article.field.private': '是否加密',
  'new_article.field.private.placeholder': '是否加密',
  'new_article.field.private.yes': '是',
  'new_article.field.private.no': '否',
  'new_article.field.password': '密码',
  'new_article.field.password.placeholder': '请输入密码',
  'new_article.field.hidden': '是否隐藏',
  'new_article.field.hidden.placeholder': '是否隐藏',
  'new_article.field.hidden.yes': '是',
  'new_article.field.hidden.no': '否',
  'new_article.field.copyright': '版权声明',
  'new_article.field.copyright.tooltip':
    '设置后会替换掉文章页底部默认的版权声明文字，留空则根据系统设置中的相关选项进行展示',
  'new_article.field.copyright.placeholder': '设置后会替换掉文章底部默认的版权',
};

export default function (props) {
  const { onFinish } = props;
  return (
    <ModalForm
      title={trans_zh['new_article.title']}
      trigger={
        <Button key="button" type="primary">
          {trans_zh['new_article.button']}
        </Button>
      }
      width={450}
      autoFocusFirstInput
      submitTimeout={3000}
      onFinish={async (values) => {
        if (location.hostname == 'blog-demo.mereith.com') {
          Modal.info({
            title: trans_zh['new_article.modal.demo.title'],
            content: trans_zh['new_article.modal.demo.content'],
          });
          return;
        }
        const washedValues = {};
        for (const [k, v] of Object.entries(values)) {
          washedValues[k.replace('C', '')] = v;
        }

        const { data } = await createArticle(washedValues);
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
        label={trans_zh['new_article.field.title']}
        placeholder={trans_zh['new_article.field.title.placeholder']}
        rules={[{ required: true, message: trans_zh['new_article.field.required'] }]}
      />
      <AuthorField />
      <ProFormText
        width="md"
        id="topC"
        name="topC"
        label={trans_zh['new_article.field.top']}
        placeholder={trans_zh['new_article.field.top.placeholder']}
      />
      <ProFormText
        width="md"
        id="pathnameC"
        name="pathnameC"
        label={trans_zh['new_article.field.pathname']}
        tooltip={trans_zh['new_article.field.pathname.tooltip']}
        placeholder={trans_zh['new_article.field.pathname.placeholder']}
      />
      <ProFormSelect
        mode="tags"
        tokenSeparators={[',']}
        width="md"
        name="tagsC"
        label={trans_zh['new_article.field.tags']}
        placeholder={trans_zh['new_article.field.tags.placeholder']}
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
        tooltip={trans_zh['new_article.field.category.tooltip']}
        label={trans_zh['new_article.field.category']}
        placeholder={trans_zh['new_article.field.category.placeholder']}
        rules={[{ required: true, message: trans_zh['new_article.field.required'] }]}
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
        placeholder={trans_zh['new_article.field.created_at.placeholder']}
        name="createdAtC"
        id="createdAtC"
        label={trans_zh['new_article.field.created_at']}
        width="md"
        showTime={{
          defaultValue: dayjs('00:00:00', 'HH:mm:ss'),
        }}
      />

      <ProFormSelect
        width="md"
        name="privateC"
        id="privateC"
        label={trans_zh['new_article.field.private']}
        placeholder={trans_zh['new_article.field.private.placeholder']}
        request={async () => {
          return [
            {
              label: trans_zh['new_article.field.private.no'],
              value: false,
            },
            {
              label: trans_zh['new_article.field.private.yes'],
              value: true,
            },
          ];
        }}
      />
      <ProFormText.Password
        label={trans_zh['new_article.field.password']}
        width="md"
        id="passwordC"
        name="passwordC"
        autocomplete="new-password"
        placeholder={trans_zh['new_article.field.password.placeholder']}
        dependencies={['private']}
      />
      <ProFormSelect
        width="md"
        name="hiddenC"
        id="hiddenC"
        label={trans_zh['new_article.field.hidden']}
        placeholder={trans_zh['new_article.field.hidden.placeholder']}
        request={async () => {
          return [
            {
              label: trans_zh['new_article.field.hidden.no'],
              value: false,
            },
            {
              label: trans_zh['new_article.field.hidden.yes'],
              value: true,
            },
          ];
        }}
      />
      <ProFormText
        width="md"
        id="copyrightC"
        name="copyrightC"
        label={trans_zh['new_article.field.copyright']}
        tooltip={trans_zh['new_article.field.copyright.tooltip']}
        placeholder={trans_zh['new_article.field.copyright.placeholder']}
      />
    </ModalForm>
  );
}
