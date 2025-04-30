import { errorImg } from '@/assets/error';
import { getImgLink } from '@/pages/ImageManage/components/tools';
import { ProFormText } from '@ant-design/pro-form';
import { Image, message } from 'antd';
import { debounce } from 'lodash-es';
import { useEffect, useMemo, useState } from 'react';
import UploadBtn from '../UploadBtn';

const trans_zh = {
  'url_form.tooltip': '上传之前需要设置好图床哦，默认为本地图床。',
  'url_form.upload_button': '上传图片',
  'url_form.success': '{name} 上传成功!',
  'url_form.exists': '{name} 已存在!',
  'url_form.required': '这是必填项',
};

interface FormRef {
  current?: {
    getFieldValue: (name: string) => string;
    getFieldsValue: () => Record<string, string>;
    setFieldsValue: (values: Record<string, string>) => void;
  };
  getFieldValue?: (name: string) => string;
  getFieldsValue?: () => Record<string, string>;
  setFieldsValue?: (values: Record<string, string>) => void;
}

export default function (props: {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
  formRef?: FormRef;
  isInit: boolean;
  isFavicon?: boolean;
  colProps?: { xs: number; sm: number };
}) {
  const [url, setUrl] = useState('');
  const handleOnChange = debounce((ev) => {
    const val = ev?.target?.value;
    if (val && val != url) {
      setUrl(val);
    }
  }, 500);

  useEffect(() => {
    if (!props.formRef) return;

    const form = props.formRef?.current || props.formRef;
    if (form?.getFieldValue) {
      const src = form.getFieldValue(props.name);
      setUrl(src);
    }
  }, [props.formRef, props.name]);

  const dest = useMemo(() => {
    let r = props.isInit ? '/api/admin/init/upload' : '/api/admin/img/upload';
    if (props.isFavicon) {
      r = r + '?favicon=true';
    }
    return r;
  }, [props.isInit, props.isFavicon]);

  interface UploadInfo {
    name: string;
    response?: {
      data?: {
        isNew?: boolean;
        src?: string;
      };
    };
  }

  const handleUploadFinish = (info: UploadInfo) => {
    if (info?.response?.data?.isNew) {
      message.success(trans_zh['url_form.success'].replace('{name}', info.name));
    } else {
      message.warning(trans_zh['url_form.exists'].replace('{name}', info.name));
    }
    const src = getImgLink(info?.response?.data?.src || '');
    setUrl(src);

    if (!props.formRef) return;

    const form = props.formRef?.current || props.formRef;
    if (form?.setFieldsValue) {
      const oldVal = form.getFieldsValue ? form.getFieldsValue() : {};
      form.setFieldsValue({
        ...oldVal,
        [props.name]: src,
      });
    }
  };

  return (
    <>
      <ProFormText
        name={props.name}
        label={props.label}
        required={props.required}
        placeholder={props.placeholder}
        tooltip={trans_zh['url_form.tooltip']}
        fieldProps={{
          onChange: handleOnChange,
        }}
        colProps={props.colProps}
        extra={
          <div style={{ display: 'flex', marginTop: '10px' }}>
            <Image src={url || ''} fallback={errorImg} height={100} width={100} />
            <div style={{ marginLeft: 10 }}>
              <UploadBtn
                setLoading={() => {}}
                muti={false}
                crop={true}
                text={trans_zh['url_form.upload_button']}
                onFinish={handleUploadFinish}
                url={dest}
                accept=".png,.jpg,.jpeg,.webp,.jiff,.gif"
              />
            </div>
          </div>
        }
        rules={
          props.required ? [{ required: true, message: trans_zh['url_form.required'] }] : undefined
        }
      />
    </>
  );
}
