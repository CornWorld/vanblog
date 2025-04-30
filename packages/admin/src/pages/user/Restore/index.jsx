import { restore } from '@/services/van-blog/api';
import { encryptPwd } from '@/services/van-blog/encryptPwd';
import ProCard from '@ant-design/pro-card';
import ProForm, { ProFormText } from '@ant-design/pro-form';
import { Alert, message } from 'antd';
import { history } from '@/utils/umiCompat';

const trans_zh = {
  'restore.title': '忘记密码',
  'restore.alert.message':
    'VanBlog 会在每次启动时在日志中打印随机的恢复密钥，同时也会将其写入到您挂载的日志目录中的 restore.key 文件中。',
  'restore.success': '重置成功！恢复密钥将重新生成！',
  'restore.field.key': '请输入恢复密钥',
  'restore.field.username': '请输入新用户名',
  'restore.field.password': '请输入新密码',
};

export default function () {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        backgroundImage: `url('/background.svg')`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100%',
        backgroundColor: '#f0f2f5',
        justifyContent: 'center',
      }}
    >
      <ProCard
        title={trans_zh['restore.title']}
        bordered
        style={{ maxWidth: '700px', marginTop: '200px', maxHeight: '470px' }}
      >
        <Alert
          type="info"
          style={{ marginBottom: 12 }}
          message={<p style={{ marginBottom: 0 }}>{trans_zh['restore.alert.message']}</p>}
        />
        <ProForm
          onFinish={async (values) => {
            await restore({
              ...values,
              password: encryptPwd(values.name, values.password),
            });
            message.success(trans_zh['restore.success']);
            history.push('/user/login');
          }}
        >
          <ProFormText.Password name="key" label={trans_zh['restore.field.key']} />
          <ProFormText name="name" label={trans_zh['restore.field.username']} />
          <ProFormText.Password name="password" label={trans_zh['restore.field.password']} />
        </ProForm>
      </ProCard>
    </div>
  );
}
