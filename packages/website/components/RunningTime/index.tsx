import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

interface RunningTimeProps {
  date?: string;
  since?: string;
  className?: string;
}

export default function RunningTime(props: RunningTimeProps) {
  const [timeDiff, setTimeDiff] = useState('');

  useEffect(() => {
    const calculateTime = () => {
      const startDate = dayjs(props.date || props.since);
      const now = dayjs();

      const years = now.diff(startDate, 'year');
      const months = now.diff(startDate, 'month') % 12;
      const days = now.diff(startDate.add(months, 'month').add(years, 'year'), 'day');

      setTimeDiff(`${years} 年 ${months} 个月 ${days} 天`);
    };

    calculateTime();

    // Update every day
    const timer = setInterval(calculateTime, 86400000);
    return () => clearInterval(timer);
  }, [props.date, props.since]);

  return <span className={props.className || ''}>{timeDiff}</span>;
}
