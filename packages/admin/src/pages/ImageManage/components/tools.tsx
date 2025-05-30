import { message } from 'antd';
import { StaticItem } from '../types';

interface MetaDictionary {
  [key: string]: string;
}

interface KeyDictionary {
  [key: string]: string;
}

export const getImgLink = (realPath: string, autoCompleteHost = true): string => {
  let url = realPath;
  if (realPath.includes('http://') || realPath.includes('https://')) {
    url = realPath;
  } else {
    if (autoCompleteHost) {
      url = `${window.location.protocol}//${window.location.host}${realPath}`;
    }
  }
  url = url.replace(/\)/g, '%29');
  url = url.replace(/\(/g, '%28');
  return url;
};

export const copyImgLink = (
  realPath: string,
  isMarkdown = false,
  info?: string,
  autoCompleteHost = true,
): void => {
  let url = getImgLink(realPath, autoCompleteHost);
  if (isMarkdown) {
    url = `![](${url})`;
  }
  try {
    navigator.clipboard.writeText(url);
    message.success(`${info ? info : ''}已复制${isMarkdown ? ' markdown ' : '图片'}链接到剪切板！`);
  } catch {
    message.error(`${info ? info : ''}复制链接到剪切板失败！`);
  }
};

export const mergeMetaInfo = (item: StaticItem): Record<string, unknown> => {
  const Dic: MetaDictionary = {
    type: '格式',
    height: '高',
    width: '宽',
    name: '名称',
    sign: 'md5',
    storageType: '存储',
    url: '外链',
    size: '大小',
  };
  const KeyDic: KeyDictionary = {
    local: '本地',
  };
  const url = getImgLink(item.realPath);
  const rawObj = {
    name: item.name,
    ...item.meta,
    sign: item.sign,
    storageType: item.storageType,
    url,
  };
  const res: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(rawObj)) {
    res[Dic[k] || k] = KeyDic[v as string] || v;
  }
  return res;
};

export const downloadImg = (name: string, url: string): void => {
  const tag = document.createElement('a');
  // 此属性的值就是下载时图片的名称，注意，名称中不能有半角点，否则下载时后缀名会错误
  tag.setAttribute('download', name);
  const link = getImgLink(url);
  tag.href = link;
  tag.dispatchEvent(new MouseEvent('click'));
};
