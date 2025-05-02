import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App, Button, Dropdown, Input, Space, Tag, Modal } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-layout';
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
import type { PathObject } from '@/services/van-blog/getPathname';
import { parseMarkdownFile, parseObjToMarkdown } from '@/services/van-blog/parseMarkdownFile';
import { useCacheState } from '@/services/van-blog/useCacheState';
import dayjs from '@/utils/dayjs';
import './index.less';

// Define types for our data structures
interface ArticleData {
  id: string | number;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  hidden?: boolean;
  updatedAt?: string;
  pathname?: string;
  [key: string]: unknown;
}

interface CacheObject {
  content: string;
  time: string;
}

// Define API response type
interface ApiResponse<T> {
  data: T;
  [key: string]: unknown;
}

export default function EditorPage() {
  // Wrap the component in App context to fix Ant Design message API warning
  return (
    <App>
      <EditorContent />
    </App>
  );
}

function EditorContent() {
  const { t } = useTranslation();
  // Use the App.useApp hook to get the context-based message API
  const { modal, message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [value, setValue] = useState('');
  const [currObj, setCurrObj] = useState<ArticleData>({ id: 0, title: '', content: '' });
  const [loading, setLoading] = useState(true);
  const [editorConfig, setEditorConfig] = useCacheState(
    { afterSave: 'stay', useLocalCache: 'close' },
    'editorConfig',
  );
  const type = new URLSearchParams(location.search).get('type') || 'article';
  const id = new URLSearchParams(location.search).get('id');

  // Memoize getCacheKey to prevent regenerating on every render
  const getCacheKey = useCallback(() => `${type}-${id || '0'}`, [type, id]);

  const typeMap: Record<string, string> = {
    article: t('editor.type.article'),
    draft: t('editor.type.draft'),
    about: t('editor.type.about'),
  };

  // Helper function to convert ArticleData to PathObject
  const toPathObject = (article: ArticleData): PathObject => ({
    id: String(article.id),
    pathname: article.pathname,
  });

  // Process cache and determine if we should use it
  const processCacheData = useCallback(
    (data: Partial<ArticleData>, noMessage?: boolean): string | null => {
      const cacheString = window.localStorage.getItem(getCacheKey());
      if (!cacheString) return null;

      let cacheObj: Partial<CacheObject> = {};
      try {
        cacheObj = JSON.parse(cacheString);
      } catch {
        window.localStorage.removeItem(getCacheKey());
        return null;
      }

      // Don't use cache if disabled in settings
      if (editorConfig?.useLocalCache === 'close') {
        window.localStorage.removeItem(getCacheKey());
        return null;
      }

      // Don't use cache if it's empty
      if (!cacheObj || !cacheObj?.content) {
        window.localStorage.removeItem(getCacheKey());
        return null;
      }

      // Don't use cache if content matches server data
      if (cacheObj?.content === data?.content) {
        window.localStorage.removeItem(getCacheKey());
        return null;
      }

      // Don't use cache if server data is newer
      const updatedAt = data?.updatedAt;
      if (!updatedAt) {
        window.localStorage.removeItem(getCacheKey());
        return null;
      }

      const cacheTime = cacheObj?.time;
      if (dayjs(updatedAt).isAfter(cacheTime)) {
        window.localStorage.removeItem(getCacheKey());
        return null;
      }

      // Cache is valid, use it
      console.log(t('editor.cache.check'));
      if (!noMessage) {
        message.success(t('editor.cache.restored'));
      }
      return cacheObj?.content;
    },
    [getCacheKey, editorConfig?.useLocalCache, t, message],
  );

  // Define fetchData function
  const fetchData = useCallback(
    async (noMessage?: boolean) => {
      setLoading(true);
      try {
        let response;
        let data: ArticleData;
        let cachedContent: string | null = null;

        switch (type) {
          case 'about': {
            response = (await getAbout()) as ApiResponse<ArticleData>;
            data = response.data || { id: '0', title: '', content: '' };

            // Check if we should use cached content
            cachedContent = processCacheData(data, noMessage);
            setValue(cachedContent || data?.content || '');

            document.title = t('editor.title.about');
            setCurrObj(data);
            break;
          }

          case 'article': {
            if (id) {
              response = (await getArticleById(id)) as ApiResponse<ArticleData>;
              data = response.data || { id: '0', title: '', content: '' };

              // Check if we should use cached content
              cachedContent = processCacheData(data, noMessage);
              setValue(cachedContent || data?.content || '');

              document.title = t('editor.title.template').replace('${title}', data?.title || '');
              setCurrObj(data);
            }
            break;
          }

          case 'draft': {
            if (id) {
              response = (await getDraftById(id)) as ApiResponse<ArticleData>;
              data = response.data || { id: '0', title: '', content: '' };

              // Check if we should use cached content
              cachedContent = processCacheData(data, noMessage);
              setValue(cachedContent || data?.content || '');

              document.title = t('editor.title.template').replace('${title}', data?.title || '');
              setCurrObj(data);
            }
            break;
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        message.error(t('editor.error.fetch'));
      } finally {
        setLoading(false);
      }
    },
    [type, id, t, message, processCacheData, setCurrObj],
  );

  // Initial data fetch only once
  useEffect(() => {
    fetchData();

    // Add class to body when component mounts
    document.body.classList.add('editor-page');

    // Remove class when component unmounts
    return () => {
      document.body.classList.remove('editor-page');
    };
  }, []);

  // Define saveFn function
  const saveFn = async () => {
    const v = value;
    setLoading(true);
    if (window.location.hostname === 'blog-demo.mereith.com' && type !== 'draft') {
      message.error('演示站禁止进行此操作');
      setLoading(false);
      return;
    }
    if (type === 'article') {
      await updateArticle(currObj?.id, { content: v });
      await fetchData(true);
      message.success(t('editor.save.success'));
    } else if (type === 'draft') {
      await updateDraft(currObj?.id, { content: v });
      await fetchData(true);
      message.success(t('editor.save.success'));
    } else if (type === 'about') {
      await updateAbout({ content: v });
      await fetchData(true);
      message.success(t('editor.save.success'));
    }
    if (editorConfig.afterSave && editorConfig.afterSave === 'goBack') {
      navigate(-1);
    }
    setLoading(false);
  };

  // Define handleSave function
  const handleSave = useCallback(async () => {
    if (window.location.hostname === 'blog-demo.mereith.com' && type !== 'draft') {
      modal.info({
        title: t('editor.modal.demo.title'),
        content: t('editor.modal.demo.content'),
      });
      return;
    }
    // Check if there's a "more" tag first
    let hasMore = true;
    if (['article', 'draft'].includes(type)) {
      if (!value?.includes('<!-- more -->')) {
        hasMore = false;
      }
    }
    let hasTags = ['article', 'draft'].includes(type) && currObj?.tags && currObj.tags.length > 0;
    if (type === 'about') {
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
  }, [modal, t, type, value, currObj, message]);

  // Define onKeyDown function
  const onKeyDown = useCallback(
    (ev: KeyboardEvent) => {
      let save = false;
      if (ev.metaKey === true && ev.key.toLowerCase() === 's') {
        save = true;
      }
      if (ev.ctrlKey === true && ev.key.toLowerCase() === 's') {
        save = true;
      }
      if (save) {
        ev.preventDefault();
        handleSave();
      }
      return false;
    },
    [handleSave],
  );

  // Set up keyboard shortcuts
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  // Collapse sidebar when entering editor
  useEffect(() => {
    // Collapse sidebar by default when entering editor
    const el = document.querySelector('.ant-pro-sider-collapsed-button');
    if (el && (el as HTMLElement).style.paddingLeft !== '') {
      (el as HTMLElement).click();
    }
  }, []);

  const handleExport = async () => {
    const md = parseObjToMarkdown(currObj);
    const data = new Blob([md]);
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currObj?.title || '关于'}.md`;
    link.click();
  };

  const handleImport = async (file: File) => {
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

  // Define menu items with proper type for Ant Design's Dropdown
  const menuItems: MenuProps['items'] = [
    {
      key: 'resetBtn',
      label: t('editor.menu.reset'),
      onClick: () => {
        setValue(currObj?.content || '');
        message.success(t('editor.message.reset.success'));
      },
    },
    type !== 'about'
      ? {
          key: 'updateModalBtn',
          label: (
            <UpdateModal
              onFinish={() => {
                fetchData(true);
              }}
              type={type as 'article' | 'draft' | 'about'}
              currObj={currObj}
              setLoading={setLoading}
            />
          ),
        }
      : null,
    type === 'draft'
      ? {
          key: 'publishBtn',
          label: (
            <PublishDraftModal
              title={currObj?.title}
              key="publishModal1"
              id={currObj?.id}
              trigger={<a key={'publishBtn' + currObj?.id}>{t('editor.menu.publish_draft')}</a>}
              onFinish={() => {
                navigate('/article');
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
          (el as HTMLElement).click();
        }
      },
    },
    {
      key: 'exportBtn',
      label: `${t('editor.menu.export')}${typeMap[type]}`,
      onClick: handleExport,
    },
    type !== 'draft'
      ? {
          key: 'viewFE',
          label: t('editor.menu.view_frontend'),
          onClick: () => {
            let url = '';
            if (type === 'article') {
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
                            navigate('/site/setting?subTab=layout');
                          }}
                        >
                          {t('editor.modal.hidden.content3')}
                        </a>{' '}
                        {t('editor.modal.hidden.content4')}
                      </p>
                    </div>
                  ),
                  onOk: () => {
                    window.open(`/post/${getPathname(toPathObject(currObj))}`, '_blank');
                    return true;
                  },
                  okText: t('editor.modal.hidden.button.visit'),
                  cancelText: t('editor.modal.hidden.button.back'),
                });
                return;
              }
              url = `/post/${getPathname(toPathObject(currObj))}`;
            } else {
              url = '/about';
            }
            window.open(url, '_blank');
          },
        }
      : undefined,
    type !== 'about'
      ? {
          key: 'deleteBtn',
          label: `${t('editor.menu.delete')}${typeMap[type]}`,
          onClick: () => {
            Modal.confirm({
              title: t('editor.modal.delete.article.title').replace('${title}', currObj.title),
              onOk: async () => {
                if (window.location.hostname === 'blog-demo.mereith.com' && type === 'article') {
                  if ([28, 29].includes(Number(currObj.id))) {
                    message.warning(t('editor.message.demo.delete.error'));
                    return false;
                  }
                }
                if (type === 'article') {
                  await deleteArticle(currObj.id);
                  message.success(t('editor.message.delete.success'));
                  navigate('/article');
                } else if (type === 'draft') {
                  await deleteDraft(currObj.id);
                  message.success(t('editor.message.delete.success'));
                  navigate('/draft');
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
  ].filter(Boolean) as MenuProps['items'];

  return (
    <PageContainer
      className="editorContainer"
      header={{
        title: (
          <Space>
            <span title={type === 'about' ? t('editor.type.about') : currObj?.title}>
              {type === 'about' ? t('editor.type.about') : currObj?.title}
            </span>
            {type !== 'about' && (
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
              navigate(-1);
            }}
          >
            {t('editor.button.back')}
          </Button>,
          <Dropdown key="moreAction" menu={{ items: menuItems }} trigger={['click']}>
            <Button size="middle">
              {t('editor.dropdown.actions')}
              <DownOutlined />
            </Button>
          </Dropdown>,
        ],
        breadcrumb: {},
      }}
      footer={[]}
    >
      <div style={{ display: 'none' }}>
        {/* File input for importing markdown */}
        <input
          type="file"
          id="importBtn"
          style={{ display: 'none' }}
          accept=".md"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImport(file);
            }
          }}
        />
      </div>
      <div className="editorWrapper">
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
