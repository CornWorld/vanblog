import React from 'react';
import { useTranslation } from 'react-i18next';
import CodeEditor from '@/components/CodeEditor';
import { getLayoutConfig, updateLayoutConfig } from '@/services/van-blog/api';
import { useTab } from '@/services/van-blog/useTab';
import { Button, Card, message, Modal, Spin } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function () {
  const { t } = useTranslation();

  const helpMap = {
    css: t('customizing.help.css'),
    script: t('customizing.help.script'),
    html: t('customizing.help.html'),
    head: t('customizing.help.head'),
  };

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
      title: t('customizing.modal.save.title'),
      content: t('customizing.modal.save.content'),
      onOk: async () => {
        setLoading(true);
        try {
          await updateLayoutConfig(values);
          message.success(t('customizing.message.update.success'));
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
    message.success(t('customizing.message.reset.success'));
  };
  const handleHelp = () => {
    Modal.info({
      title: t('customizing.modal.help.title'),
      content: (
        <div>
          <p>{helpMap[tab]}</p>
          <a
            target="_blank"
            href="https://vanblog.mereith.com/feature/advance/customizing.html"
            rel="noreferrer"
          >
            {t('customizing.modal.help.doc')}
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
      tab: t('customizing.tab.css'),
    },
    {
      key: 'script',
      tab: t('customizing.tab.script'),
    },
    {
      key: 'html',
      tab: t('customizing.tab.html'),
    },
    {
      key: 'head',
      tab: t('customizing.tab.head'),
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
            {t('customizing.button.save')}
          </Button>,
          <Button type="link" key="reset" onClick={handleReset}>
            {t('customizing.button.reset')}
          </Button>,
          <Button type="link" key="help" onClick={handleHelp}>
            {t('customizing.button.help')}
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
