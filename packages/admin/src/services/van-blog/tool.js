import dayjs from '@/utils/dayjs';
import i18next from 'i18next';

export const randomKey = () => {
  return (Math.random() * 1000000).toFixed(0);
};

const formatStr = 'YYYY-MM-DD HH:mm:ss';

export const getTime = (str) => {
  if (!str) {
    return '-';
  }
  return dayjs(str).format(formatStr);
};

export const formatTimes = (...args) => {
  for (const each of args) {
    try {
      return dayjs(each).format(formatStr);
    } catch {
      // Ignore formatting errors and try next date
    }
  }
  return '-';
};

export const getRecentTimeDes = (timestr) => {
  if (!timestr || timestr == '') {
    return '-';
  }
  const c = dayjs().diff(dayjs(timestr), 'second');
  if (c <= 60) {
    return i18next.t('time.seconds_ago', { seconds: c });
  } else if (c <= 60 * 60) {
    return i18next.t('time.minutes_ago', { minutes: Math.floor(c / 60) });
  } else if (c <= 60 * 60 * 60) {
    return i18next.t('time.hours_ago', { hours: Math.floor(c / 60 / 60) });
  } else if (c <= 60 * 60 * 60 * 24) {
    return i18next.t('time.days_ago', { days: Math.floor(c / 60 / 60 / 24) });
  }
};
