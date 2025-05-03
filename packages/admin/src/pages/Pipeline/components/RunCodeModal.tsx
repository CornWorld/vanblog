import React from 'react';
import { useTranslation } from 'react-i18next';
import { checkJsonString } from '@/services/van-blog/checkJson';
import { ModalForm, ProFormTextArea } from '@ant-design/pro-form';
import { triggerPipelineById } from '@/services/van-blog/api';
import { message, Modal } from 'antd';

interface Pipeline {
  id: string;
  script: string;
  eventName: string;
  name: string;
}

interface RunCodeModalProps {
  pipeline: Pipeline;
  trigger: React.ReactNode;
}

interface PipelineRunInput {
  input?: Record<string, unknown>;
}

interface ApiResponse {
  data?: unknown;
  [key: string]: unknown;
}

export default function RunCodeModal({ pipeline, trigger }: RunCodeModalProps) {
  const { t } = useTranslation();
  const runCode = async (inputJson?: string) => {
    const dto: PipelineRunInput = {};
    if (inputJson) {
      const inputObj = JSON.parse(inputJson);
      dto.input = inputObj;
    }
    const response = (await triggerPipelineById(pipeline.id, dto)) as ApiResponse;
    Modal.info({
      title: t('pipeline.modal.result.title'),
      width: 800,
      content: (
        <pre
          style={{
            maxHeight: '60vh',
            overflow: 'auto',
          }}
        >
          {JSON.stringify(response.data, null, 2)}
        </pre>
      ),
    });
  };
  return (
    <ModalForm
      title={t('pipeline.modal.run.title')}
      onFinish={async (vals: { input?: string }) => {
        if (!vals.input) {
          runCode();
          return true;
        } else {
          if (!checkJsonString(vals.input)) {
            message.error(t('pipeline.message.error.json_format'));
            return false;
          } else {
            runCode(vals.input);
            return true;
          }
        }
      }}
      trigger={trigger}
    >
      <ProFormTextArea
        label={t('pipeline.form.input.label')}
        name="input"
        tooltip={t('pipeline.form.input.tooltip')}
      />
    </ModalForm>
  );
}
