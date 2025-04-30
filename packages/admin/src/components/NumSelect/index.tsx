import { Select } from 'antd';

const trans_zh = {
  'numselect.recent': '近{n}{unit}',
};

interface SelectOption {
  label: string;
  value: number;
}

const optionNum = [3, 5, 7, 10, 15, 30];
const generateOptions = (nums: number[], d: string): SelectOption[] => {
  const res: SelectOption[] = [];
  nums.forEach((n) => {
    res.push({
      label: trans_zh['numselect.recent'].replace('{n}', n.toString()).replace('{unit}', d),
      value: n,
    });
  });
  return res;
};

interface NumSelectProps {
  value: number;
  setValue: (n: number) => void;
  d: string;
}

export default function (props: NumSelectProps) {
  return (
    <Select
      size={'small'}
      value={props.value}
      onChange={(v) => {
        props.setValue(v);
      }}
      options={generateOptions(optionNum, props.d)}
    />
  );
}
