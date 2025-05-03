import React from 'react';
import CodeEditor from '@/components/CodeEditor';
import UploadBtn from '@/components/UploadBtn';
import {
  getCustomPageByPath,
  getCustomPageFileDataByPath,
  getCustomPageFolderTreeByPath,
  updateCustomPage,
  updateCustomPageFileInFolder,
  getPipelineById,
  updatePipelineById,
  getPipelineConfig,
} from '@/services/van-blog/api';
import { DownOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-layout';
import { Button, Dropdown, Menu, message, Modal, Space, Spin, Tag, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { history } from '@/router';
import PipelineModal from '../Pipeline/components/PipelineModal';
import RunCodeModal from '../Pipeline/components/RunCodeModal';
import './index.less';
import type { ReactNode } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
const { DirectoryTree } = Tree;

interface TreeNode extends DataNode {
  type?: 'file' | 'directory';
  key: string;
  children?: TreeNode[];
  title: string | ReactNode;
  isLeaf?: boolean;
}

interface CustomPage {
  name: string;
  html: string;
  id: string;
}

interface Pipeline {
  id: string;
  script: string;
  eventName: string;
  name: string;
}

interface PipelineConfig {
  eventName: string;
  eventNameChinese: string;
  passive: boolean;
}

const renderTreeNodes = (data: TreeNode[]): ReactNode[] => {
  return data.map((item) => {
    if (item.children) {
      return (
        <Tree.TreeNode title={item.title} key={item.key} isLeaf={item.type === 'file'}>
          {renderTreeNodes(item.children)}
        </Tree.TreeNode>
      );
    }
    return <Tree.TreeNode title={item.title} key={item.key} isLeaf={item.type === 'file'} />;
  });
};

export default function CodePage() {
  const [value, setValue] = useState('');
  const [currObj, setCurrObj] = useState<CustomPage | Pipeline | null>(null);
  const [node, setNode] = useState<TreeNode | undefined>();
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig[]>([]);
  const [pathPrefix, setPathPrefix] = useState('');
  const [treeData, setTreeData] = useState<TreeNode[]>([
    { title: 'door', key: '123', type: 'directory' },
  ]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [treeLoading, setTreeLoading] = useState(true);
  const [editorWidth, setEditorWidth] = useState(400);
  const [editorHeight, setEditorHeight] = useState<number>(window.innerHeight - 82);
  const query = new URLSearchParams(history.location.search);
  const type = query.get('type') || '';
  const path = query.get('path') || '';
  const id = query.get('id') || '';
  const isFolder = type === 'folder';
  const typeMap: Record<string, string> = {
    file: '单文件页面',
    folder: '多文件页面',
    pipeline: '流水线',
    default: '未知类型',
  };

  useEffect(() => {
    getPipelineConfig().then(({ data }) => {
      setPipelineConfig(data);
    });
  }, []);

  const language = useMemo(() => {
    if (type == 'pipeline') {
      return 'javascript';
    }
    if (!node) {
      return 'html';
    }
    const name = node.title;
    if (!name) {
      return 'html';
    }
    const cssArr = ['css', 'less', 'scss'];
    const tsArr = ['ts', 'tsx'];
    const htmlArr = ['html', 'htm'];
    const jsArr = ['js', 'jsx'];
    const m = {
      javascript: jsArr,
      typescript: tsArr,
      html: htmlArr,
      css: cssArr,
    };
    for (const [k, v] of Object.entries(m)) {
      const title = String(name);
      if (v.some((t) => title.includes('.' + t))) {
        return k;
      }
    }
    return 'html';
  }, [node, type]);

  const fetchFileData = async (node: TreeNode) => {
    setEditorLoading(true);
    try {
      const { data } = await getCustomPageFileDataByPath(path, node.key);
      setValue(data);
    } catch (error) {
      console.error('Failed to fetch file data:', error);
      message.error('获取文件数据失败！');
    } finally {
      setEditorLoading(false);
    }
  };

  const handleTreeSelect = (_: Key[], info: { node: TreeNode }) => {
    if (editorLoading) {
      message.warning('加载中请勿选择!');
      return;
    }
    const selectedNode = info.node;
    setSelectedKeys([selectedNode.key]);
    setNode(selectedNode);

    if (selectedNode.type === 'file') {
      fetchFileData(selectedNode);
      const arr = selectedNode.key.toString().split('/');
      arr.pop();
      setPathPrefix(arr.join('/'));
    } else {
      setPathPrefix(selectedNode.key.toString());
    }
  };

  const handleTreeExpand = (_: Key[], info: { node: TreeNode }) => {
    const selectedNode = info.node;
    setSelectedKeys([selectedNode.key]);
  };

  const updateEditorSize = useCallback(() => {
    const headerEl = document.querySelector('.ant-page-header');
    if (headerEl) {
      const fullWidthString = window.getComputedStyle(headerEl).width;
      const fullWidth = parseInt(fullWidthString.replace('px', ''));
      const width = isFolder ? fullWidth - 1 - 200 : fullWidth;
      setEditorWidth(width);

      const HeaderHeightString = window.getComputedStyle(headerEl).height;
      const HeaderHeight = parseInt(HeaderHeightString.replace('px', ''));
      setEditorHeight(window.innerHeight - HeaderHeight - 12);
    }
  }, [isFolder]);

  const onClickMenuChangeBtn = useCallback(() => {
    const menuBtnEl = document.querySelector('.ant-pro-sider-collapsed-button');
    if (menuBtnEl) {
      menuBtnEl.addEventListener('click', () => {
        setTimeout(() => {
          updateEditorSize();
        }, 500);
      });
    }
  }, [updateEditorSize]);

  useEffect(() => {
    window.addEventListener('resize', updateEditorSize);
    onClickMenuChangeBtn();
    return () => {
      window.removeEventListener('resize', updateEditorSize);
      const menuBtnEl = document.querySelector('.ant-pro-sider-collapsed-button');
      if (menuBtnEl) {
        menuBtnEl.removeEventListener('click', onClickMenuChangeBtn);
      }
    };
  }, [onClickMenuChangeBtn, updateEditorSize]);

  const handleSave = useCallback(async () => {
    if (location.hostname == 'blog-demo.mereith.com') {
      Modal.info({
        title: '演示站不可修改此项！',
      });
      return;
    }
    if (type == 'file') {
      setEditorLoading(true);
      await updateCustomPage({ ...currObj, html: value });
      setEditorLoading(false);
      message.success('当前编辑器内文件保存成功！');
    } else if (type == 'pipeline' && currObj) {
      setEditorLoading(true);
      await updatePipelineById(currObj.id, { script: value });
      setEditorLoading(false);
      message.success('当前编辑器内脚本保存成功！');
    } else {
      setEditorLoading(true);
      if (node?.key) {
        await updateCustomPageFileInFolder(path, node.key, value);
        message.success('当前编辑器内文件保存成功！');
      }
      setEditorLoading(false);
      return;
    }
  }, [type, currObj, value, path, node, setEditorLoading]);

  const onKeyDown = useCallback(
    (ev: ReactKeyboardEvent) => {
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

  useEffect(() => {
    const handleKeyDown = (ev: globalThis.KeyboardEvent) => {
      onKeyDown(ev as unknown as ReactKeyboardEvent);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onKeyDown]);

  useEffect(() => {
    setTimeout(() => {
      updateEditorSize();
    }, 300);
  }, [updateEditorSize]);

  const fetchData = useCallback(async () => {
    if (!path && !id) {
      message.error('无有效信息，无法获取数据！');
      return;
    }

    try {
      if (isFolder) {
        setTreeLoading(true);
        setCurrObj({ name: path, html: '', id: path });
        const { data } = await getCustomPageFolderTreeByPath(path);
        if (data) setTreeData(data);
        setTreeLoading(false);
      } else if (type === 'pipeline') {
        if (!id) {
          message.error('无有效信息，无法获取数据！');
          return;
        }
        setEditorLoading(true);
        const { data } = await getPipelineById(id);
        if (data) {
          setCurrObj(data);
          setValue(data?.script || '');
        }
        setEditorLoading(false);
      } else {
        setEditorLoading(true);
        const { data } = await getCustomPageByPath(path);
        if (data) {
          setCurrObj(data);
          setValue(data?.html || '');
        }
        setEditorLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
      message.error('获取数据失败！');
    }
  }, [path, id, type, isFolder]);

  const actionMenu = (
    <Menu
      items={[
        {
          key: 'saveBtn',
          label: '保存',
          onClick: handleSave,
        },
        ...(type == 'pipeline'
          ? [
              {
                key: 'runPipeline',
                label: <RunCodeModal pipeline={currObj} trigger={<a>调试脚本</a>} />,
              },
              {
                key: 'editPipelineInfo',
                label: (
                  <PipelineModal
                    mode="edit"
                    trigger={<a>编辑信息</a>}
                    onFinish={() => {
                      fetchData();
                    }}
                    initialValues={currObj}
                  />
                ),
              },
            ]
          : []),
        ...(isFolder
          ? [
              {
                key: 'uploadFile',
                label: (
                  <UploadBtn
                    setLoading={setUploadLoading}
                    folder={true}
                    muti={true}
                    customUpload={true}
                    text="上传文件夹"
                    onFinish={() => {
                      fetchData();
                    }}
                    url={`/api/admin/customPage/upload?path=${path}`}
                    accept="*"
                    loading={uploadLoading}
                    plainText={true}
                  />
                ),
              },
              {
                key: 'uploadFolder',
                label: (
                  <UploadBtn
                    basePath={pathPrefix}
                    customUpload={true}
                    plainText={true}
                    setLoading={setUploadLoading}
                    folder={false}
                    muti={false}
                    text="上传文件"
                    onFinish={() => {
                      fetchData();
                    }}
                    url={`/api/admin/customPage/upload?path=${path}`}
                    accept="*"
                    loading={uploadLoading}
                  />
                ),
              },
            ]
          : []),
        ...(type == 'file'
          ? [
              {
                key: 'view',
                label: '查看',
                onClick: () => {
                  window.open(`/c${path}`);
                },
              },
            ]
          : []),
      ]}
    ></Menu>
  );
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  return (
    <PageContainer
      className="editor-full"
      header={{
        title: (
          <Space>
            <span title={currObj?.name}>{currObj?.name}</span>
            <>
              <Tag color="green">{typeMap[type] || typeMap.default}</Tag>
              {type === 'pipeline' && currObj && 'eventName' in currObj && (
                <>
                  <Tag color="blue">
                    {
                      pipelineConfig.find((p) => p.eventName === currObj.eventName)
                        ?.eventNameChinese
                    }
                  </Tag>
                  {pipelineConfig.find((p) => p.eventName === currObj.eventName)?.passive ? (
                    <Tag color="yellow">非阻塞</Tag>
                  ) : (
                    <Tag color="red">阻塞</Tag>
                  )}
                </>
              )}
            </>
          </Space>
        ),
        extra: [
          <Dropdown key="moreAction" menu={{ items: actionMenu }} trigger={['click']}>
            <Button size="middle" type="primary">
              操作
              <DownOutlined />
            </Button>
          </Dropdown>,
          <Button
            key="backBtn"
            onClick={() => {
              history.go(-1);
            }}
          >
            返回
          </Button>,
          <Button
            key="docBtn"
            onClick={() => {
              if (type == 'pipeline') {
                window.open('https://vanblog.mereith.com/features/pipeline.html', '_blank');
              } else {
                window.open(
                  'https://vanblog.mereith.com/feature/advance/customPage.html',
                  '_blank',
                );
              }
            }}
          >
            文档
          </Button>,
        ],
        breadcrumb: {},
      }}
      footer={[]}
    >
      <div style={{ height: '100%', display: 'flex' }} className="code-editor-content">
        {isFolder && (
          <>
            <Spin spinning={treeLoading}>
              <div
                className="file-tree-container"
                onClick={(ev) => {
                  const container = document.querySelector('.file-tree-container');
                  const tree = document.querySelector('.ant-tree-list');
                  if (container && tree && (ev.target === container || ev.target === tree)) {
                    setSelectedKeys([]);
                    setPathPrefix('');
                  }
                }}
                style={{
                  width: '200px',
                  background: 'white',
                }}
              >
                <DirectoryTree
                  style={{ height: `${editorHeight}px` }}
                  className="file-tree"
                  defaultExpandAll
                  selectedKeys={selectedKeys}
                  onSelect={handleTreeSelect}
                  onExpand={handleTreeExpand}
                >
                  {treeData.length > 0 ? renderTreeNodes(treeData) : []}
                </DirectoryTree>
              </div>
            </Spin>
            <div className="divider-v"></div>
          </>
        )}
        <Spin spinning={editorLoading}>
          <CodeEditor
            value={value}
            onChange={setValue}
            language={language}
            width={editorWidth}
            height={editorHeight}
          />
        </Spin>
      </div>
    </PageContainer>
  );
}
