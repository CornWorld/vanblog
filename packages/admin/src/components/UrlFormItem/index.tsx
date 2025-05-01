import React from 'react';
import { useTranslation } from 'react-i18next';
import { errorImg } from '@/assets/error';
import { getImgLink } from '@/pages/ImageManage/components/tools';
import { ProFormText } from '@ant-design/pro-form';
import { Image, message } from 'antd';
import { debounce } from 'lodash-es';
import { useEffect, useMemo, useState } from 'react';
import UploadBtn from '../UploadBtn';

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

interface UrlFormItemProps {
  name: string;
  label: string;
  placeholder: string;
  required: boolean;
  formRef?: FormRef;
  isInit: boolean;
  isFavicon?: boolean;
  colProps?: { xs: number; sm: number };
}

export default function UrlFormItem(props: UrlFormItemProps) {
  const { t } = useTranslation();
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
      message.success(t('url_form.success', { name: info.name }));
    } else {
      message.warning(t('url_form.exists', { name: info.name }));
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
        tooltip={t('url_form.tooltip')}
        fieldProps={{
          onChange: handleOnChange,
        }}
        colProps={props.colProps}
        extra={
          <div style={{ display: 'flex', marginTop: '10px' }}>
            <Image src={url || ''} fallback={errorImg} height={100} width={100} />
            <div style={{ marginLeft: 10 }}>
              <UploadBtn
                setLoading={() => {
                  /* handle loading state if needed */
                }}
                muti={false}
                crop={true}
                text={t('url_form.upload_button')}
                onFinish={handleUploadFinish}
                url={dest}
                accept=".png,.jpg,.jpeg,.webp,.jiff,.gif"
              />
            </div>
          </div>
        }
        rules={props.required ? [{ required: true, message: t('url_form.required') }] : undefined}
      />
    </>
  );
}
