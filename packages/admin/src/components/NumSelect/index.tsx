import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from 'antd';

interface SelectOption {
  label: string;
  value: number;
}

const optionNum = [3, 5, 7, 10, 15, 30];

interface NumSelectProps {
  value: number;
  setValue: (n: number) => void;
  d: string;
}

export default function (props: NumSelectProps) {
  const { t } = useTranslation();

  const generateOptions = (nums: number[], d: string): SelectOption[] => {
    const res: SelectOption[] = [];
    nums.forEach((n) => {
      res.push({
        label: t('numselect.recent', { n: n.toString(), unit: d }),
        value: n,
      });
    });
    return res;
  };

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
