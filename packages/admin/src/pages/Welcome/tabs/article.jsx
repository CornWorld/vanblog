import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { Spin } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { getWelcomeData } from '@/services/van-blog/api';
import '../index.less';
import NumSelect from '@/components/NumSelect';
import { Pie, Column } from '@ant-design/plots';
import { useNum } from '@/services/van-blog/useNum';
import RcResizeObserver from 'rc-resize-observer';

const trans_zh = {
  'article.stat.count': '文章数',
  'article.stat.word_count': '总字数',
  'article.stat.category_count': '分类数',
  'article.stat.tag_count': '标签数',
  'article.chart.category_pie': '分类饼图',
  'article.chart.tag_column': '标签文章数 TOP 柱状图',
  'article.meta.tag_name': '标签名',
  'article.meta.article_count': '文章数量',
};

const ArticleTab = () => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [responsive, setResponsive] = useState(false);
  const [num, setNum] = useNum(5);
  const fetchData = useCallback(async () => {
    const { data: res } = await getWelcomeData('article', 5, 5, num);
    setData(res);
  }, [setData, num]);
  useEffect(() => {
    setLoading(true);
    fetchData().then(() => {
      setLoading(false);
    });
  }, [fetchData, setLoading]);
  const pieConfig = {
    data: data?.categoryPieData || [],
    // appendPadding: 10,
    angleField: 'value',
    colorField: 'type',
    radius: 0.75,
    label: {
      type: 'spider',
      labelHeight: 28,
      content: '{name}\n{percentage}',
    },
    interactions: [
      {
        type: 'element-selected',
      },
      {
        type: 'element-active',
      },
    ],
  };
  const columnConfig = {
    data: data?.columnData || [],
    xField: 'type',
    yField: 'value',
    label: {
      // 可手动配置 label 数据标签位置
      position: 'middle',
      // 'top', 'bottom', 'middle',
      // 配置样式
    },
    color: () => {
      return '#1772B4';
    },
    xAxis: {
      label: {
        autoHide: true,
        autoRotate: false,
      },
    },
    meta: {
      type: {
        alias: trans_zh['article.meta.tag_name'],
      },
      value: {
        alias: trans_zh['article.meta.article_count'],
      },
    },
  };
  return (
    <RcResizeObserver
      key="resize-observer"
      onResize={(offset) => {
        setResponsive(offset.width < 596);
      }}
    >
      <Spin spinning={loading}>
        <ProCard
          bordered
          split={responsive ? 'horizontal' : 'vertical'}
          style={{ marginBottom: responsive ? 8 : 0 }}
        >
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: trans_zh['article.stat.count'],
              value: data?.articleNum || 0,
              layout: responsive ? 'horizontal' : 'vertical',
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: trans_zh['article.stat.word_count'],
              value: data?.wordNum || 0,
              layout: responsive ? 'horizontal' : 'vertical',
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: trans_zh['article.stat.category_count'],
              value: data?.categoryNum || 0,
              layout: responsive ? 'horizontal' : 'vertical',
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: trans_zh['article.stat.tag_count'],
              value: data?.tagNum || 0,
              layout: responsive ? 'horizontal' : 'vertical',
            }}
          />
        </ProCard>
        <ProCard
          split={responsive ? 'horizontal' : 'vertical'}
          bordered
          style={{ marginBottom: responsive ? 8 : 0 }}
        >
          <StatisticCard
            colSpan={24}
            className="card-full-title"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{trans_zh['article.chart.category_pie']}</div>
              </div>
            }
            chart={
              <div style={{ marginTop: -30 }}>
                <Pie {...pieConfig} />
              </div>
            }
          />
        </ProCard>
        <ProCard
          split={responsive ? 'horizontal' : 'vertical'}
          bordered
          style={{ marginBottom: responsive ? 8 : 0 }}
        >
          <StatisticCard
            colSpan={24}
            className="card-full-title"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{trans_zh['article.chart.tag_column']}</div>
                <NumSelect d="条" value={num} setValue={setNum} />
              </div>
            }
            chart={
              <div style={{ marginTop: -10 }}>
                <Column {...columnConfig} />
              </div>
            }
          />
        </ProCard>
      </Spin>
    </RcResizeObserver>
  );
};

export default ArticleTab;
