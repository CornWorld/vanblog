import CodeEditor from '@/components/CodeEditor';
import { getLayoutConfig, updateLayoutConfig } from '@/services/van-blog/api';
import { useTab } from '@/services/van-blog/useTab';
import { Button, Card, message, Modal, Spin } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

const trans_zh = {
  'customizing.help.css':
    '自定义 css 会把您写入的 css 代码作为 <style> 标签插入到前台页面中的 <head> 中。',
  'customizing.help.script':
    '自定义 script 会把您写入的 script 代码作为 <script> 标签插入到前台页面的最下方。',
  'customizing.help.html':
    '自定义 html 会把您写入的 html 代码插入到前台页面 body 标签中的下方。是静态化的，首屏源代码即存在。',
  'customizing.help.head':
    '自定义 html 会把您写入的 html 代码插入到前台页面的 head 标签中的下方。是静态化的，首屏源代码即存在，可以用于网站所有权验证。',
  'customizing.modal.save.title': '保存确认',
  'customizing.modal.save.content':
    '在保存前请确认代码的正确性,有问题的代码可能导致前台报错！如不生效，请检查是否在站点配置/布局设置中打开了客制化功能。',
  'customizing.message.update.success': '更新成功！',
  'customizing.message.reset.success': '重置成功！',
  'customizing.modal.help.title': '帮助',
  'customizing.modal.help.doc': '帮助文档',
  'customizing.tab.css': '自定义 CSS',
  'customizing.tab.script': '自定义 Script',
  'customizing.tab.html': '自定义 HTML (body)',
  'customizing.tab.head': '自定义 HTML (head)',
  'customizing.button.save': '保存',
  'customizing.button.reset': '重置',
  'customizing.button.help': '帮助',
};

const helpMap = {
  css: trans_zh['customizing.help.css'],
  script: trans_zh['customizing.help.script'],
  html: trans_zh['customizing.help.html'],
  head: trans_zh['customizing.help.head'],
};

export default function () {
  const [tab, setTab] = useTab('css', 'customTab');
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState({
    css: '',
    script: '',
    html: '',
    head: '',
  });
  const cardRef = useRef();
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getLayoutConfig();
      if (data) {
        setValues({
          css: data?.css || '',
          script: data?.script || '',
          html: data?.html || '',
          head: data?.head || '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch layout config:', error);
      message.error('Failed to fetch customization settings');
    } finally {
      setLoading(false);
    }
  }, [setValues, setLoading]);
  const handleSave = async () => {
    Modal.confirm({
      title: trans_zh['customizing.modal.save.title'],
      content: trans_zh['customizing.modal.save.content'],
      onOk: async () => {
        setLoading(true);
        try {
          await updateLayoutConfig(values);
          message.success(trans_zh['customizing.message.update.success']);
        } catch (error) {
          console.error('Failed to update layout config:', error);
          message.error('Failed to save customization settings');
        } finally {
          setLoading(false);
        }
      },
    });
  };
  const handleReset = async () => {
    fetchData();
    message.success(trans_zh['customizing.message.reset.success']);
  };
  const handleHelp = () => {
    Modal.info({
      title: trans_zh['customizing.modal.help.title'],
      content: (
        <div>
          <p>{helpMap[tab]}</p>
          <a
            target="_blank"
            href="https://vanblog.mereith.com/feature/advance/customizing.html"
            rel="noreferrer"
          >
            {trans_zh['customizing.modal.help.doc']}
          </a>
        </div>
      ),
    });
  };
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  const languageMap = {
    css: 'css',
    script: 'javascript',
    html: 'html',
    head: 'html',
  };

  const tabList = [
    {
      key: 'css',
      tab: trans_zh['customizing.tab.css'],
    },
    {
      key: 'script',
      tab: trans_zh['customizing.tab.script'],
    },
    {
      key: 'html',
      tab: trans_zh['customizing.tab.html'],
    },
    {
      key: 'head',
      tab: trans_zh['customizing.tab.head'],
    },
  ];
  return (
    <>
      <Card
        ref={cardRef}
        tabList={tabList}
        onTabChange={setTab}
        activeTabKey={tab}
        defaultActiveTabKey={'css'}
        className="card-body-full"
        actions={[
          <Button type="link" key="save" onClick={handleSave}>
            {trans_zh['customizing.button.save']}
          </Button>,
          <Button type="link" key="reset" onClick={handleReset}>
            {trans_zh['customizing.button.reset']}
          </Button>,
          <Button type="link" key="help" onClick={handleHelp}>
            {trans_zh['customizing.button.help']}
          </Button>,
        ]}
      >
        <Spin spinning={loading}>
          {tab == 'css' && (
            <CodeEditor
              height={600}
              language={languageMap[tab]}
              onChange={(v) => {
                setValues({ ...values, [tab]: v });
              }}
              value={values[tab] || ''}
            />
          )}
          {tab == 'script' && (
            <CodeEditor
              height={600}
              language={languageMap[tab]}
              onChange={(v) => {
                setValues({ ...values, [tab]: v });
              }}
              value={values[tab] || ''}
            />
          )}
          {tab == 'html' && (
            <CodeEditor
              height={600}
              language={languageMap[tab]}
              onChange={(v) => {
                setValues({ ...values, [tab]: v });
              }}
              value={values[tab] || ''}
            />
          )}
          {tab == 'head' && (
            <CodeEditor
              height={600}
              language={languageMap[tab]}
              onChange={(v) => {
                setValues({ ...values, [tab]: v });
              }}
              value={values[tab] || ''}
            />
          )}
        </Spin>
      </Card>
    </>
  );
}
