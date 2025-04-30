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

const trans_zh = {
  'editor.cache.check': '[缓存检查] 本地缓存时间晚于服务器更新时间，使用缓存',
  'editor.cache.restored': '从缓存中恢复状态！',
  'editor.title.about': '关于 - VanBlog 编辑器',
  'editor.title.template': '${title} - VanBlog 编辑器',
  'editor.save.success': '保存成功！',
  'editor.modal.demo.title': '演示站禁止修改此信息！',
  'editor.modal.demo.content': '本来是可以的，但有个人在演示站首页放黄色信息，所以关了这个权限了。',
  'editor.modal.delete.title': '确定要删除吗？',
  'editor.modal.delete.content': '删除后不可恢复！',
  'editor.message.delete.success': '删除成功！',
  'editor.button.save': '保存',
  'editor.button.last_saved': '上次保存',
  'editor.button.setting': '设置',
  'editor.button.export': '导出',
  'editor.button.import': '导入',
  'editor.button.preview': '预览',
  'editor.button.publish': '发布',
  'editor.button.update_info': '修改信息',
  'editor.button.delete': '删除',
  'editor.type.article': '文章',
  'editor.type.draft': '草稿',
  'editor.type.about': '关于',
  'editor.import.md_only': '仅接受 md 文件',
  'editor.import.success': '导入成功！',
  'editor.import.error': '导入失败！',
  'editor.modal.save.title': '确定保存吗？',
  'editor.modal.save.tags.missing': '此文章还没设置标签呢',
  'editor.modal.more.missing.title': '缺少完整的 more 标记！',
  'editor.modal.more.missing.content1': '这可能会造成阅读全文前的图片语句被截断从而无法正常显示！',
  'editor.modal.more.missing.content2': '默认将截取指定的字符数量作为阅读全文前的内容。',
  'editor.modal.more.missing.content3':
    '您可以点击编辑器工具栏最后第一个按钮在合适的地方插入标记。',
  'editor.modal.more.missing.docs': '相关文档',
  'editor.menu.reset': '重置',
  'editor.message.reset.success': '重置为初始值成功！',
  'editor.menu.update': '更新信息',
  'editor.menu.publish_draft': '发布草稿',
  'editor.menu.import_content': '导入内容',
  'editor.menu.export': '导出',
  'editor.menu.view_frontend': '查看前台',
  'editor.modal.hidden.title': '此文章为隐藏文章！',
  'editor.modal.hidden.content1':
    '隐藏文章在未开启通过 URL 访问的情况下（默认关闭），会出现 404 页面！',
  'editor.modal.hidden.content2': '您可以在',
  'editor.modal.hidden.content3': '布局配置',
  'editor.modal.hidden.content4': '中修改此项。',
  'editor.modal.hidden.button.visit': '仍然访问',
  'editor.modal.hidden.button.back': '返回',
  'editor.menu.delete': '删除',
  'editor.modal.delete.article.title': '确定删除 "${title}" 吗？',
  'editor.message.demo.delete.error': '演示站禁止删除此文章！',
  'editor.menu.setting': '偏好设置',
  'editor.menu.clear_cache': '清理缓存',
  'editor.modal.clear_cache.title': '清理实时保存缓存',
  'editor.modal.clear_cache.content':
    '确定清理当前内容的实时保存缓存吗？清理后未保存的内容将会丢失，编辑器内容将重置为服务端返回的最新数据。',
  'editor.modal.clear_cache.ok': '确认清理',
  'editor.modal.clear_cache.cancel': '返回',
  'editor.message.clear_cache.success': '清除实时保存缓存成功！已重置为服务端返回数据',
  'editor.menu.help': '帮助文档',
  'editor.header.category': '分类',
  'editor.button.back': '返回',
  'editor.dropdown.actions': '操作',
  'editor.modal.import.title': '确认内容',
};

export default function () {
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
    article: trans_zh['editor.type.article'],
    draft: trans_zh['editor.type.draft'],
    about: trans_zh['editor.type.about'],
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
          console.log(trans_zh['editor.cache.check']);
          return cacheObj?.content;
        }
      };

      if (type == 'about') {
        const { data } = await getAbout();
        const cache = checkCache(data);
        if (cache) {
          if (!noMessage) {
            message.success(trans_zh['editor.cache.restored']);
          }
          setValue(cache);
        } else {
          setValue(data?.content || '');
        }
        document.title = trans_zh['editor.title.about'];
        setCurrObj(data);
      }
      if (type == 'article' && id) {
        const { data } = await getArticleById(id);
        const cache = checkCache(data);
        if (cache) {
          setValue(cache);
          if (!noMessage) {
            message.success(trans_zh['editor.cache.restored']);
          }
        } else {
          setValue(data?.content || '');
        }
        document.title = trans_zh['editor.title.template'].replace('${title}', data?.title || '');
        setCurrObj(data);
      }
      if (type == 'draft' && id) {
        const { data } = await getDraftById(id);
        const cache = checkCache(data);
        if (cache) {
          if (!noMessage) {
            message.success(trans_zh['editor.cache.restored']);
          }
          setValue(cache);
        } else {
          setValue(data?.content || '');
        }
        setCurrObj(data);
        document.title = trans_zh['editor.title.template'].replace('${title}', data?.title || '');
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
      message.success(trans_zh['editor.save.success']);
    } else if (type == 'draft') {
      await updateDraft(currObj?.id, { content: v });
      await fetchData();
      message.success(trans_zh['editor.save.success']);
    } else if (type == 'about') {
      await updateAbout({ content: v });
      await fetchData();
      message.success(trans_zh['editor.save.success']);
    }
    if (editorConfig.afterSave && editorConfig.afterSave == 'goBack') {
      history.go(-1);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (location.hostname == 'blog-demo.mereith.com' && type != 'draft') {
      modal.info({
        title: trans_zh['editor.modal.demo.title'],
        content: trans_zh['editor.modal.demo.content'],
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
      title: `${trans_zh['editor.modal.save.title']}${hasTags ? '' : trans_zh['editor.modal.save.tags.missing']}`,
      content: hasMore ? undefined : (
        <div style={{ marginTop: 8 }}>
          <p>{trans_zh['editor.modal.more.missing.title']}</p>
          <p>{trans_zh['editor.modal.more.missing.content1']}</p>
          <p>{trans_zh['editor.modal.more.missing.content2']}</p>
          <p>
            {trans_zh['editor.modal.more.missing.content3']}
            <a
              target={'_blank'}
              rel="noreferrer"
              href="https://vanblog.mereith.com/feature/basic/editor.html#%E4%B8%80%E9%94%AE%E6%8F%92%E5%85%A5-more-%E6%A0%87%E8%AE%B0"
            >
              {trans_zh['editor.modal.more.missing.docs']}
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
        title: trans_zh['editor.modal.import.title'],
        content: <Input.TextArea value={content} autoSize={{ maxRows: 10, minRows: 5 }} />,
        onOk: () => {
          setValue(content);
          message.success(trans_zh['editor.import.success']);
        },
      });
    } catch (error) {
      console.error('Import error:', error);
      message.error(trans_zh['editor.import.error']);
    }
    setLoading(false);
    return false;
  };
  const actionMenu = (
    <Menu
      items={[
        {
          key: 'resetBtn',
          label: trans_zh['editor.menu.reset'],
          onClick: () => {
            setValue(currObj?.content || '');
            message.success(trans_zh['editor.message.reset.success']);
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
                  trigger={
                    <a key={'publishBtn' + currObj?.id}>{trans_zh['editor.menu.publish_draft']}</a>
                  }
                  onFinish={() => {
                    history.push(`/article`);
                  }}
                />
              ),
            }
          : null,
        {
          key: 'importBtn',
          label: trans_zh['editor.menu.import_content'],
          onClick: () => {
            const el = document.querySelector('#importBtn');
            if (el) {
              el.click();
            }
          },
        },
        {
          key: 'exportBtn',
          label: `${trans_zh['editor.menu.export']}${typeMap[type]}`,
          onClick: handleExport,
        },
        type != 'draft'
          ? {
              key: 'viewFE',
              label: trans_zh['editor.menu.view_frontend'],
              onClick: () => {
                let url = '';
                if (type == 'article') {
                  if (currObj.hidden) {
                    Modal.confirm({
                      title: trans_zh['editor.modal.hidden.title'],
                      content: (
                        <div>
                          <p>{trans_zh['editor.modal.hidden.content1']}</p>
                          <p>
                            {trans_zh['editor.modal.hidden.content2']}{' '}
                            <a
                              onClick={() => {
                                history.push('/site/setting?subTab=layout');
                              }}
                            >
                              {trans_zh['editor.modal.hidden.content3']}
                            </a>{' '}
                            {trans_zh['editor.modal.hidden.content4']}
                          </p>
                        </div>
                      ),
                      onOk: () => {
                        window.open(`/post/${getPathname(currObj)}`, '_blank');
                        return true;
                      },
                      okText: trans_zh['editor.modal.hidden.button.visit'],
                      cancelText: trans_zh['editor.modal.hidden.button.back'],
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
              label: `${trans_zh['editor.menu.delete']}${typeMap[type]}`,
              onClick: () => {
                Modal.confirm({
                  title: trans_zh['editor.modal.delete.article.title'].replace(
                    '${title}',
                    currObj.title,
                  ),
                  onOk: async () => {
                    if (location.hostname == 'blog-demo.mereith.com' && type == 'article') {
                      if ([28, 29].includes(currObj.id)) {
                        message.warn(trans_zh['editor.message.demo.delete.error']);
                        return false;
                      }
                    }
                    if (type == 'article') {
                      await deleteArticle(currObj.id);
                      message.success(trans_zh['editor.message.delete.success']);
                      history.push('/article');
                    } else if (type == 'draft') {
                      await deleteDraft(currObj.id);
                      message.success(trans_zh['editor.message.delete.success']);
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
              trigger={<a key={'editerConfigBtn'}>{trans_zh['editor.menu.setting']}</a>}
            />
          ),
        },
        {
          key: 'clearCacheBtn',
          label: trans_zh['editor.menu.clear_cache'],
          onClick: () => {
            Modal.confirm({
              title: trans_zh['editor.modal.clear_cache.title'],
              content: trans_zh['editor.modal.clear_cache.content'],
              okText: trans_zh['editor.modal.clear_cache.ok'],
              cancelText: trans_zh['editor.modal.clear_cache.cancel'],
              onOk: () => {
                window.localStorage.removeItem(getCacheKey());
                setValue(currObj?.content || '');
                message.success(trans_zh['editor.message.clear_cache.success']);
              },
            });
          },
        },
        {
          key: 'helpBtn',
          label: trans_zh['editor.menu.help'],
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
            <span title={type == 'about' ? trans_zh['editor.type.about'] : currObj?.title}>
              {type == 'about' ? trans_zh['editor.type.about'] : currObj?.title}
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
            {trans_zh['editor.button.back']}
          </Button>,
          <Dropdown key="moreAction" overlay={actionMenu} trigger={['click']}>
            <Button size="middle">
              {trans_zh['editor.dropdown.actions']}
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
            {trans_zh['editor.menu.import_content']}
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
