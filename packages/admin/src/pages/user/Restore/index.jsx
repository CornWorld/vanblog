import { useTranslation } from 'react-i18next';
import { restore } from '@/services/van-blog/api';
import ProCard from '@ant-design/pro-card';
import ProForm, { ProFormText } from '@ant-design/pro-form';
import { Alert, message } from 'antd';
import { history } from '@/router';

function RestorePage() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        backgroundImage: `url('${import.meta.env.BASE_URL}background.svg')`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100%',
        backgroundColor: '#f0f2f5',
        justifyContent: 'center',
      }}
    >
      <ProCard
        title={t('restore.title')}
        bordered
        style={{ maxWidth: '700px', marginTop: '200px', maxHeight: '470px' }}
      >
        <Alert
          type="info"
          style={{ marginBottom: 12 }}
          message={<p style={{ marginBottom: 0 }}>{t('restore.alert.message')}</p>}
        />
        <ProForm
          onFinish={async (values) => {
            await restore(values);
            message.success(t('restore.success'));
            history.push('/user/login');
          }}
        >
          <ProFormText.Password name="key" label={t('restore.field.key')} />
          <ProFormText name="name" label={t('restore.field.username')} />
          <ProFormText.Password name="password" label={t('restore.field.password')} />
        </ProForm>
      </ProCard>
    </div>
  );
}

export default RestorePage;
