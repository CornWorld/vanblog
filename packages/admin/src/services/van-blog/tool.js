import dayjs from '@/utils/dayjs';

const trans_zh = {
  'time.seconds_ago': '{seconds}秒前',
  'time.minutes_ago': '{minutes}分钟前',
  'time.hours_ago': '{hours}小时前',
  'time.days_ago': '{days}天前',
};

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
    return trans_zh['time.seconds_ago'].replace('{seconds}', c);
  } else if (c <= 60 * 60) {
    return trans_zh['time.minutes_ago'].replace('{minutes}', Math.floor(c / 60));
  } else if (c <= 60 * 60 * 60) {
    return trans_zh['time.hours_ago'].replace('{hours}', Math.floor(c / 60 / 60));
  } else if (c <= 60 * 60 * 60 * 24) {
    return trans_zh['time.days_ago'].replace('{days}', Math.floor(c / 60 / 60 / 24));
  }
};
