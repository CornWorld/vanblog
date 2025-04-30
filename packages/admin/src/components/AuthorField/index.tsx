import { ProFormSelect } from '@ant-design/pro-form';
import { getAllCollaboratorsList } from '@/services/van-blog/api';

const trans_zh = {
  'author_field.label': '作者',
  'author_field.placeholder': '不填默认为登录者本人',
};

export default () => (
  <ProFormSelect
    width="md"
    id="author"
    name="author"
    label={trans_zh['author_field.label']}
    placeholder={trans_zh['author_field.placeholder']}
    request={async () =>
      (await getAllCollaboratorsList())?.data?.map(({ name, nickname = name }) => ({
        label: nickname,
        value: nickname,
      })) || []
    }
  />
);
