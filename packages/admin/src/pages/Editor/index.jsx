import React from 'react';
import { useTranslation } from 'react-i18next';
import Editor from '@/components/Editor';
import EditorProfileModal from '@/components/EditorProfileModal';
import PublishDraftModal from '@/components/PublishDraftModal';
import Tags from '@/components/Tags';
import UpdateModal from '@/components/UpdateModal';
import { SaveTip } from '@/components/SaveTip';
import {
  deleteArticle,
  deleteDraft,
  getAbout,
  getArticleById,
  getDraftById,
  updateAbout,
  updateArticle,
  updateDraft,
} from '@/services/van-blog/api';
import { getPathname } from '@/services/van-blog/getPathname';
import { parseMarkdownFile, parseObjToMarkdown } from '@/services/van-blog/parseMarkdownFile';
import { useCacheState } from '@/services/van-blog/useCacheState';
import { DownOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-layout';
import { App, Button, Dropdown, Input, Menu, message, Modal, Space, Tag, Upload } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { history } from '@/router';
import dayjs from '@/utils/dayjs';
import './index.less';

export default function () {
  const { t } = useTranslation();
  const { modal } = App.useApp();
  const [value, setValue] = useState('');
  const [currObj, setCurrObj] = useState({});
  const [loading, setLoading] = useState(true);
  const [editorConfig, setEditorConfig] = useCacheState(
    { afterSave: 'stay', useLocalCache: 'close' },
    'editorConfig',
  );
  const type = history.location.query?.type || 'article';
  const getCacheKey = () => `${type}-${history.location.query?.id || '0'}`;

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [currObj, value, type]);
  const onKeyDown = (ev) => {
    let save = false;
    if (ev.metaKey == true && ev.key.toLocaleLowerCase() == 's') {
      save = true;
    }
    if (ev.ctrlKey == true && ev.key.toLocaleLowerCase() == 's') {
      save = true;
    }
    if (save) {
      event?.preventDefault();
      ev?.preventDefault();
      handleSave();
    }
    return false;
  };

  const typeMap = {
    article: t('editor.type.article'),
    draft: t('editor.type.draft'),
    about: t('editor.type.about'),
  };
  const fetchData = useCallback(
    async (noMessage) => {
      setLoading(true);

      const type = history.location.query?.type || 'article';
      const id = history.location.query?.id;
      const cacheString = window.localStorage.getItem(getCacheKey());
      let cacheObj = {};
      try {
        cacheObj = JSON.parse(cacheString || '{}');
      } catch {
        window.localStorage.removeItem(getCacheKey());
      }
      const checkCache = (data) => {
        const clear = () => {
          window.localStorage.removeItem(getCacheKey());
        };
        if (editorConfig?.useLocalCache == 'close') {
          clear();
          return false;
        }
        if (!cacheObj || !cacheObj?.content) {
          clear();
          return false;
        }
        if (cacheObj?.content == data?.content) {
          clear();
          return false;
        }
        const updatedAt = data?.updatedAt;
        if (!updatedAt) {
          clear();
          return false;
        }
        const cacheTime = cacheObj?.time;
        if (dayjs(updatedAt).isAfter(cacheTime)) {
          clear();
          return false;
        } else {
          console.log(t('editor.cache.check'));
          return cacheObj?.content;
        }
      };

      if (type == 'about') {
        const { data } = await getAbout();
        const cache = checkCache(data);
        if (cache) {
          if (!noMessage) {
            message.success(t('editor.cache.restored'));
          }
          setValue(cache);
        } else {
          setValue(data?.content || '');
        }
        document.title = t('editor.title.about');
        setCurrObj(data);
      }
      if (type == 'article' && id) {
        const { data } = await getArticleById(id);
        const cache = checkCache(data);
        if (cache) {
          setValue(cache);
          if (!noMessage) {
            message.success(t('editor.cache.restored'));
          }
        } else {
          setValue(data?.content || '');
        }
        document.title = t('editor.title.template').replace('${title}', data?.title || '');
        setCurrObj(data);
      }
      if (type == 'draft' && id) {
        const { data } = await getDraftById(id);
        const cache = checkCache(data);
        if (cache) {
          if (!noMessage) {
            message.success(t('editor.cache.restored'));
          }
          setValue(cache);
        } else {
          setValue(data?.content || '');
        }
        setCurrObj(data);
        document.title = t('editor.title.template').replace('${title}', data?.title || '');
      }
      setLoading(false);
    },
    [editorConfig],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // 进入默认收起侧边栏
    const el = document.querySelector('.ant-pro-sider-collapsed-button');
    if (el && el.style.paddingLeft != '') {
      el.click();
    }
  }, []);

  const saveFn = async () => {
    const v = value;
    setLoading(true);
    if (location.hostname == 'blog-demo.mereith.com' && type != 'draft') {
      message.error('演示站禁止进行此操作');
      setLoading(false);
      return;
    }
    if (type == 'article') {
      await updateArticle(currObj?.id, { content: v });
      await fetchData();
      message.success(t('editor.save.success'));
    } else if (type == 'draft') {
      await updateDraft(currObj?.id, { content: v });
      await fetchData();
      message.success(t('editor.save.success'));
    } else if (type == 'about') {
      await updateAbout({ content: v });
      await fetchData();
      message.success(t('editor.save.success'));
    }
    if (editorConfig.afterSave && editorConfig.afterSave == 'goBack') {
      history.go(-1);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (location.hostname == 'blog-demo.mereith.com' && type != 'draft') {
      modal.info({
        title: t('editor.modal.demo.title'),
        content: t('editor.modal.demo.content'),
      });
      return;
    }
    // 先检查一下有没有 more .
    let hasMore = true;
    if (['article', 'draft'].includes(history.location.query?.type)) {
      if (!value?.includes('<!-- more -->')) {
        hasMore = false;
      }
    }
    let hasTags =
      ['article', 'draft'].includes(history.location.query?.type) &&
      currObj?.tags &&
      currObj.tags.length > 0;
    if (history.location.query?.type == 'about') {
      hasTags = true;
    }
    modal.confirm({
      title: `${t('editor.modal.save.title')}${hasTags ? '' : t('editor.modal.save.tags.missing')}`,
      content: hasMore ? undefined : (
        <div style={{ marginTop: 8 }}>
          <p>{t('editor.modal.more.missing.title')}</p>
          <p>{t('editor.modal.more.missing.content1')}</p>
          <p>{t('editor.modal.more.missing.content2')}</p>
          <p>
            {t('editor.modal.more.missing.content3')}
            <a
              target={'_blank'}
              rel="noreferrer"
              href="https://vanblog.mereith.com/feature/basic/editor.html#%E4%B8%80%E9%94%AE%E6%8F%92%E5%85%A5-more-%E6%A0%87%E8%AE%B0"
            >
              {t('editor.modal.more.missing.docs')}
            </a>
          </p>
          <img src="/more.png" alt="more" width={200}></img>
        </div>
      ),
      onOk: saveFn,
    });
  };
  const handleExport = async () => {
    const md = parseObjToMarkdown(currObj);
    const data = new Blob([md]);
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currObj?.title || '关于'}.md`;
    link.click();
  };
  const handleImport = async (file) => {
    setLoading(true);
    try {
      const { content } = await parseMarkdownFile(file);
      modal.confirm({
        title: t('editor.modal.import.title'),
        content: <Input.TextArea value={content} autoSize={{ maxRows: 10, minRows: 5 }} />,
        onOk: () => {
          setValue(content);
          message.success(t('editor.import.success'));
        },
      });
    } catch (error) {
      console.error('Import error:', error);
      message.error(t('editor.import.error'));
    }
    setLoading(false);
    return false;
  };
  const actionMenu = (
    <Menu
      items={[
        {
          key: 'resetBtn',
          label: t('editor.menu.reset'),
          onClick: () => {
            setValue(currObj?.content || '');
            message.success(t('editor.message.reset.success'));
          },
        },
        type != 'about'
          ? {
              key: 'updateModalBtn',
              label: (
                <UpdateModal
                  onFinish={() => {
                    fetchData(true);
                  }}
                  type={type}
                  currObj={currObj}
                  setLoading={setLoading}
                />
              ),
            }
          : null,
        type == 'draft'
          ? {
              key: 'publishBtn',
              label: (
                <PublishDraftModal
                  title={currObj?.title}
                  key="publishModal1"
                  id={currObj?.id}
                  trigger={<a key={'publishBtn' + currObj?.id}>{t('editor.menu.publish_draft')}</a>}
                  onFinish={() => {
                    history.push(`/article`);
                  }}
                />
              ),
            }
          : null,
        {
          key: 'importBtn',
          label: t('editor.menu.import_content'),
          onClick: () => {
            const el = document.querySelector('#importBtn');
            if (el) {
              el.click();
            }
          },
        },
        {
          key: 'exportBtn',
          label: `${t('editor.menu.export')}${typeMap[type]}`,
          onClick: handleExport,
        },
        type != 'draft'
          ? {
              key: 'viewFE',
              label: t('editor.menu.view_frontend'),
              onClick: () => {
                let url = '';
                if (type == 'article') {
                  if (currObj.hidden) {
                    Modal.confirm({
                      title: t('editor.modal.hidden.title'),
                      content: (
                        <div>
                          <p>{t('editor.modal.hidden.content1')}</p>
                          <p>
                            {t('editor.modal.hidden.content2')}{' '}
                            <a
                              onClick={() => {
                                history.push('/site/setting?subTab=layout');
                              }}
                            >
                              {t('editor.modal.hidden.content3')}
                            </a>{' '}
                            {t('editor.modal.hidden.content4')}
                          </p>
                        </div>
                      ),
                      onOk: () => {
                        window.open(`/post/${getPathname(currObj)}`, '_blank');
                        return true;
                      },
                      okText: t('editor.modal.hidden.button.visit'),
                      cancelText: t('editor.modal.hidden.button.back'),
                    });
                    return;
                  }
                  url = `/post/${getPathname(currObj)}`;
                } else {
                  url = '/about';
                }
                window.open(url, '_blank');
              },
            }
          : undefined,
        type != 'about'
          ? {
              key: 'deleteBtn',
              label: `${t('editor.menu.delete')}${typeMap[type]}`,
              onClick: () => {
                Modal.confirm({
                  title: t('editor.modal.delete.article.title').replace('${title}', currObj.title),
                  onOk: async () => {
                    if (location.hostname == 'blog-demo.mereith.com' && type == 'article') {
                      if ([28, 29].includes(currObj.id)) {
                        message.warn(t('editor.message.demo.delete.error'));
                        return false;
                      }
                    }
                    if (type == 'article') {
                      await deleteArticle(currObj.id);
                      message.success(t('editor.message.delete.success'));
                      history.push('/article');
                    } else if (type == 'draft') {
                      await deleteDraft(currObj.id);
                      message.success(t('editor.message.delete.success'));
                      history.push('/draft');
                    }
                  },
                });
              },
            }
          : undefined,
        {
          key: 'settingBtn',
          label: (
            <EditorProfileModal
              value={editorConfig}
              setValue={setEditorConfig}
              trigger={<a key={'editerConfigBtn'}>{t('editor.menu.setting')}</a>}
            />
          ),
        },
        {
          key: 'clearCacheBtn',
          label: t('editor.menu.clear_cache'),
          onClick: () => {
            Modal.confirm({
              title: t('editor.modal.clear_cache.title'),
              content: t('editor.modal.clear_cache.content'),
              okText: t('editor.modal.clear_cache.ok'),
              cancelText: t('editor.modal.clear_cache.cancel'),
              onOk: () => {
                window.localStorage.removeItem(getCacheKey());
                setValue(currObj?.content || '');
                message.success(t('editor.message.clear_cache.success'));
              },
            });
          },
        },
        {
          key: 'helpBtn',
          label: t('editor.menu.help'),
          onClick: () => {
            window.open('https://vanblog.mereith.com/feature/basic/editor.html', '_blank');
          },
        },
      ]}
    ></Menu>
  );
  return (
    <PageContainer
      className="editorContainer"
      header={{
        title: (
          <Space>
            <span title={type == 'about' ? t('editor.type.about') : currObj?.title}>
              {type == 'about' ? t('editor.type.about') : currObj?.title}
            </span>
            {type != 'about' && (
              <>
                <Tag color="green">{typeMap[type] || '-'}</Tag>
                <Tag color="blue">{currObj?.category || '-'}</Tag>
                <Tags tags={currObj?.tags} />
              </>
            )}
          </Space>
        ),
        extra: [
          <Button key="extraSaveBtn" type="primary" onClick={handleSave}>
            {<SaveTip />}
          </Button>,
          <Button
            key="backBtn"
            onClick={() => {
              history.go(-1);
            }}
          >
            {t('editor.button.back')}
          </Button>,
          <Dropdown key="moreAction" overlay={actionMenu} trigger={['click']}>
            <Button size="middle">
              {t('editor.dropdown.actions')}
              <DownOutlined />
            </Button>
          </Dropdown>,
        ],
        breadcrumb: {},
      }}
      footer={null}
    >
      <div style={{ display: 'none' }}>
        <Upload
          showUploadList={false}
          multiple={false}
          accept={'.md'}
          beforeUpload={handleImport}
          style={{ display: 'none' }}
        >
          <a key="importBtn" type="link" style={{ display: 'none' }} id="importBtn">
            {t('editor.menu.import_content')}
          </a>
        </Upload>
      </div>
      <div className="editor-wrapper">
        <Editor
          loading={loading}
          setLoading={setLoading}
          value={value}
          onChange={(v) => {
            setValue(v);
            const date = new Date();
            window.localStorage.setItem(
              getCacheKey(),
              JSON.stringify({
                content: v,
                time: date,
              }),
            );
          }}
        />
      </div>
    </PageContainer>
  );
}
