import { Button, message } from 'antd';
import { getClipboardContents } from '@/services/van-blog/clipboard';
import { useTranslation } from 'react-i18next';

export interface CopyUploadBtnProps {
  url: string;
  accept: string;
  text?: string;
  setLoading: (loading: boolean) => void;
  onFinish: (data: unknown) => void;
  onError: () => void;
}

export default function (props: CopyUploadBtnProps) {
  const { t } = useTranslation();

  const handleClick = async () => {
    props.setLoading(true);

    const fileObj = await getClipboardContents();

    if (!fileObj) {
      props.setLoading(false);
      props.onError();
      return;
    }
    const formData = new FormData();

    formData.append('file', fileObj);

    return fetch('/api/admin/img/upload?withWaterMark=true', {
      method: 'POST',
      headers: {
        token: localStorage.getItem('token') || 'null',
      },
      body: formData,
    })
      .then((res) => res.json())
      .then(({ statusCode, data }) => {
        if (statusCode === 200) {
          props?.onFinish(data);
        } else {
          message.error(t('upload.fail') || t('copy_upload.fail'));
        }
      })
      .catch(() => {
        message.error(t('upload.fail') || t('copy_upload.fail'));
      })
      .finally(() => {
        props.setLoading(false);
      });
  };

  return (
    <div>
      <Button onClick={handleClick} type="primary">
        {props.text || t('upload.clipboardImage') || t('copy_upload.button')}
      </Button>
    </div>
  );
}
