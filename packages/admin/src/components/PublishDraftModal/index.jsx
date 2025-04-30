import { publishDraft } from '@/services/van-blog/api';
import { ModalForm, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { message, Modal } from 'antd';

const trans_zh = {
  'publish.modal.title': '发布草稿: {title}',
  'publish.modal.demo.title': '演示站禁止新建文章！',
  'publish.modal.demo.content':
    '本来是可以的，但有个人在演示站首页放黄色信息，所以关了这个权限了。',
  'publish.message.success': '发布成功！',
  'publish.field.private': '是否加密',
  'publish.field.private.placeholder': '是否加密',
  'publish.field.option.no': '否',
  'publish.field.option.yes': '是',
  'publish.field.toppriority': '置顶优先级',
  'publish.field.toppriority.placeholder': '留空或0表示不置顶，其余数字越大表示优先级越高',
  'publish.field.pathname': '自定义路径名',
  'publish.field.pathname.tooltip':
    '文章发布后的路径将为 /post/[自定义路径名]，如果未设置则使用文章 id 作为路径名',
  'publish.field.pathname.placeholder': '留空或为空则使用 id 作为路径名',
  'publish.field.password': '密码',
  'publish.field.password.placeholder': '请输入密码',
  'publish.field.hidden': '是否隐藏',
  'publish.field.hidden.placeholder': '是否隐藏',
  'publish.field.copyright': '版权声明',
  'publish.field.copyright.tooltip':
    '设置后会替换掉文章页底部默认的版权声明文字，留空则根据系统设置中的相关选项进行展示',
  'publish.field.copyright.placeholder': '设置后会替换掉文章底部默认的版权',
};

export default function (props) {
  const { title, id, trigger, action } = props;
  return (
    <>
      <ModalForm
        title={trans_zh['publish.modal.title'].replace('{title}', title)}
        key="publishModal"
        trigger={trigger}
        width={450}
        autoFocusFirstInput
        submitTimeout={3000}
        onFinish={async (values) => {
          if (location.hostname == 'blog-demo.mereith.com') {
            Modal.info({
              title: trans_zh['publish.modal.demo.title'],
              content: trans_zh['publish.modal.demo.content'],
            });
            return;
          }
          await publishDraft(id, {
            ...values,
            password: values.pc,
            top: values.Ctop,
          });
          message.success(trans_zh['publish.message.success']);
          if (action && action.reload) {
            action.reload();
          }
          if (props.onFinish) {
            props.onFinish();
          }
          return true;
        }}
        layout="horizontal"
        labelCol={{ span: 6 }}
      >
        <ProFormSelect
          width="md"
          name="private"
          id="private"
          label={trans_zh['publish.field.private']}
          placeholder={trans_zh['publish.field.private.placeholder']}
          request={async () => {
            return [
              {
                label: trans_zh['publish.field.option.no'],
                value: false,
              },
              {
                label: trans_zh['publish.field.option.yes'],
                value: true,
              },
            ];
          }}
        />
        <ProFormText
          label={trans_zh['publish.field.toppriority']}
          width="md"
          id="top"
          name="Ctop"
          placeholder={trans_zh['publish.field.toppriority.placeholder']}
          autocomplete="new-password"
          fieldProps={{
            autocomplete: 'new-password',
          }}
        />
        <ProFormText
          width="md"
          id="pathname"
          name="pathname"
          label={trans_zh['publish.field.pathname']}
          tooltip={trans_zh['publish.field.pathname.tooltip']}
          placeholder={trans_zh['publish.field.pathname.placeholder']}
        />
        <ProFormText.Password
          label={trans_zh['publish.field.password']}
          width="md"
          autocomplete="new-password"
          id="password"
          name="pc"
          placeholder={trans_zh['publish.field.password.placeholder']}
          dependencies={['private']}
          fieldProps={{
            autocomplete: 'new-password',
          }}
        />
        <ProFormSelect
          width="md"
          name="hidden"
          id="hidden"
          label={trans_zh['publish.field.hidden']}
          placeholder={trans_zh['publish.field.hidden.placeholder']}
          request={async () => {
            return [
              {
                label: trans_zh['publish.field.option.no'],
                value: false,
              },
              {
                label: trans_zh['publish.field.option.yes'],
                value: true,
              },
            ];
          }}
        />
        <ProFormText
          width="md"
          id="copyright"
          name="copyright"
          label={trans_zh['publish.field.copyright']}
          tooltip={trans_zh['publish.field.copyright.tooltip']}
          placeholder={trans_zh['publish.field.copyright.placeholder']}
        />
      </ModalForm>
    </>
  );
}
