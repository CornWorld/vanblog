import { checkJsonString } from '@/services/van-blog/checkJson';
import { ModalForm, ProFormTextArea } from '@ant-design/pro-form';
import { triggerPipelineById } from '@/services/van-blog/api';
import { message, Modal } from 'antd';

const trans_zh = {
  'pipeline.modal.run.title': '调试代码（请先保存）',
  'pipeline.modal.result.title': '运行结果',
  'pipeline.message.error.json_format': '请输入正确的json格式！',
  'pipeline.form.input.label': '输入（json 格式）',
  'pipeline.form.input.tooltip': '请输入给脚本传入的参数，JSON 格式，会注入到脚本的 input 中。',
};

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
  const runCode = async (inputJson?: string) => {
    const dto: PipelineRunInput = {};
    if (inputJson) {
      const inputObj = JSON.parse(inputJson);
      dto.input = inputObj;
    }
    const response = (await triggerPipelineById(pipeline.id, dto)) as ApiResponse;
    Modal.info({
      title: trans_zh['pipeline.modal.result.title'],
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
      title={trans_zh['pipeline.modal.run.title']}
      onFinish={async (vals: { input?: string }) => {
        if (!vals.input) {
          runCode();
          return true;
        } else {
          if (!checkJsonString(vals.input)) {
            message.error(trans_zh['pipeline.message.error.json_format']);
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
        label={trans_zh['pipeline.form.input.label']}
        name="input"
        tooltip={trans_zh['pipeline.form.input.tooltip']}
      />
    </ModalForm>
  );
}
