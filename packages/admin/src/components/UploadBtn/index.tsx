import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, message, Upload } from 'antd';
import ImgCrop from 'antd-img-crop';
import { RcFile } from 'antd/lib/upload';
import { UploadFile } from 'antd/lib/upload/interface';

interface UploadBtnProps {
  setLoading: (loading: boolean) => void;
  text: string;
  onFinish: (file: UploadFile | RcFile, name?: string) => void;
  url: string;
  accept: string;
  muti: boolean;
  crop?: boolean;
  folder?: boolean;
  customUpload?: boolean;
  basePath?: string | undefined;
  loading?: boolean;
  plainText?: boolean;
}

export default function UploadBtn(props: UploadBtnProps) {
  const { t } = useTranslation();

  const upload = (file: RcFile, rPath: string) => {
    const formData = new FormData();
    let fileName = rPath || file.name;
    if (!props.folder && props.basePath) {
      fileName = `${props.basePath}/${file.name}`;
    }
    formData.append('file', file, fileName);
    props.setLoading(true);
    fetch(`${props.url}&name=${fileName}`, {
      method: 'POST',
      body: formData,
      headers: {
        token: (() => {
          return window.localStorage.getItem('token') || 'null';
        })(),
      },
    })
      .then((res) => res.json())
      .then(() => {
        props?.onFinish(file, fileName);
      })
      .catch(() => {
        message.error(t('upload.fail', { name: fileName }));
      })
      .finally(() => {
        props.setLoading(false);
      });
  };
  const Core = (
    <Upload
      showUploadList={false}
      // name="file"
      multiple={props.muti}
      accept={props.accept}
      action={props.url}
      directory={props.folder}
      beforeUpload={
        props.customUpload
          ? (file) => {
              let rPath = file.webkitRelativePath;
              if (rPath && rPath.split('/').length >= 2) {
                rPath = rPath.split('/').slice(1).join('/');
              }
              upload(file, rPath);
              return false;
            }
          : undefined
      }
      headers={{
        token: (() => {
          return window.localStorage.getItem('token') || 'null';
        })(),
      }}
      onChange={(info) => {
        props?.setLoading(true);
        if (info.file.status !== 'uploading') {
          // console.log(info.file, info.fileList);
        }
        if (info.file.status === 'done') {
          props?.setLoading(false);
          props?.onFinish(info.file);
        } else if (info.file.status === 'error') {
          message.error(t('upload.fail', { name: info.file.name }));
          props?.setLoading(false);
        }
      }}
    >
      {props.plainText ? (
        props.text
      ) : (
        <Button type="primary" loading={props.loading}>
          {props.text}
        </Button>
      )}
    </Upload>
  );
  if (props.crop) {
    return (
      <ImgCrop quality={1} fillColor="rgba(255,255,255,0)">
        {Core}
      </ImgCrop>
    );
  } else {
    return Core;
  }
}
