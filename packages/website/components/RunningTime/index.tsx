import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'next-i18next';

interface RunningTimeProps {
  date?: string;
  since?: string;
  className?: string;
}

export default function RunningTime(props: RunningTimeProps) {
  const { t } = useTranslation();
  const [timeDiff, setTimeDiff] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const startDate = dayjs(props.date || props.since);
      const now = dayjs();

      const years = now.diff(startDate, 'year');
      const months = now.diff(startDate, 'month') % 12;
      const days = now.diff(startDate.add(months, 'month').add(years, 'year'), 'day');

      setTimeDiff(
        `${years} ${t('time.year')} ${months} ${t('time.month')} ${days} ${t('time.day')}`,
      );
    };

    calculateTime();

    // Update every day
    const timer = setInterval(calculateTime, 86400000);
    return () => clearInterval(timer);
  }, [props.date, props.since, t]);

  return <span className={props.className || ''}>{timeDiff}</span>;
}
