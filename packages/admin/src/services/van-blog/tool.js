import dayjs from '@/utils/dayjs';

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
    return c + '秒前';
  } else if (c <= 60 * 60) {
    return Math.floor(c / 60) + '分钟前';
  } else if (c <= 60 * 60 * 60) {
    return Math.floor(c / 60 / 60) + '小时前';
  } else if (c <= 60 * 60 * 60 * 24) {
    return Math.floor(c / 60 / 60 / 24) + '天前';
  }
};
