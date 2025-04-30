import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { Spin } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWelcomeData } from '@/services/van-blog/api';
import ArticleList from '@/components/ArticleList';
import { getRecentTimeDes } from '@/services/van-blog/tool';
import { Link } from '@/utils/umiCompat';
import TipTitle from '@/components/TipTitle';
import '../index.less';
import NumSelect from '@/components/NumSelect';
import { useNum } from '@/services/van-blog/useNum';
import RcResizeObserver from 'rc-resize-observer';

const trans_zh = {
  'viewer.stat.baidu': '百度统计',
  'viewer.stat.enabled': '已开启',
  'viewer.stat.unconfigured': '未配置',
  'viewer.stat.google': '谷歌分析',
  'viewer.stat.recent_visit': '最近访问',
  'viewer.stat.recent_path': '最近访问路径',
  'viewer.stat.total_visitors': '总访客数',
  'viewer.stat.total_visitors.tip': '以浏览器内缓存的唯一标识符为衡量标准计算全站独立访客的数量',
  'viewer.stat.total_views': '总访问数',
  'viewer.stat.total_views.tip': '以每一次页面的访问及跳转为衡量标准计算全站的访问数量',
  'viewer.stat.max_article_visitors': '单篇最高访客数',
  'viewer.stat.max_article_visitors.tip':
    '以浏览器内缓存的唯一标识符为衡量标准计算出单篇文章最高的独立访客数',
  'viewer.stat.max_article_views': '单篇最高访问量',
  'viewer.stat.max_article_views.tip':
    '以每一次页面的访问及跳转为衡量标准计算出单篇文章最高的访问量',
  'viewer.chart.recent_visit_top': '最近访问TOP',
  'viewer.chart.article_views_top': '文章访问量TOP',
};

const Viewer = () => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [responsive, setResponsive] = useState(false);
  const [num, setNum] = useNum(5);
  const fetchData = useCallback(async () => {
    const { data: res } = await getWelcomeData('viewer', 5, num);
    setData(res);
  }, [setData, num]);
  useEffect(() => {
    setLoading(true);
    fetchData().then(() => {
      setLoading(false);
    });
  }, [fetchData, setLoading]);

  const recentHref = useMemo(() => {
    if (!data) {
      return undefined;
    }
    if (!data?.siteLastVisitedPathname) {
      return undefined;
    }
    return data?.siteLastVisitedPathname;
  }, [data]);
  const recentVisitTime = useMemo(() => {
    if (!data) {
      return '-';
    }
    if (!data.siteLastVisitedTime) {
      return '-';
    }
    return getRecentTimeDes(data?.siteLastVisitedTime);
  }, [data]);

  return (
    <RcResizeObserver
      key="resize-observer"
      onResize={(offset) => {
        setResponsive(offset.width < 596);
      }}
    >
      <Spin spinning={loading}>
        <ProCard
          split={responsive ? 'horizontal' : 'vertical'}
          bordered
          style={{ marginBottom: responsive ? 8 : 0 }}
        >
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              layout: responsive ? 'horizontal' : 'vertical',
              title: (
                <a
                  href="https://tongji.baidu.com/main/homepage/"
                  className="ua blue"
                  target="_blank"
                  rel="noreferrer"
                >
                  {trans_zh['viewer.stat.baidu']}
                </a>
              ),
              formatter: () => {
                if (data?.enableBaidu) {
                  return <span>{trans_zh['viewer.stat.enabled']}</span>;
                } else {
                  return (
                    <Link to={`/admin/site/setting?siteInfoTab=more`}>
                      {trans_zh['viewer.stat.unconfigured']}
                    </Link>
                  );
                }
              },
              status: data?.enableBaidu ? 'success' : 'error',
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              layout: responsive ? 'horizontal' : 'vertical',
              title: (
                <a
                  href="https://analytics.google.com/analytics/web/"
                  className="ua blue"
                  target="_blank"
                  rel="noreferrer"
                >
                  {trans_zh['viewer.stat.google']}
                </a>
              ),
              formatter: () => {
                if (data?.enableGA) {
                  return <span>{trans_zh['viewer.stat.enabled']}</span>;
                } else {
                  return (
                    <Link to={`/admin/site/setting?siteInfoTab=more`}>
                      {trans_zh['viewer.stat.unconfigured']}
                    </Link>
                  );
                }
              },
              status: data?.enableGA ? 'success' : 'error',
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              layout: responsive ? 'horizontal' : 'vertical',
              title: trans_zh['viewer.stat.recent_visit'],
              value: recentVisitTime,
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              layout: responsive ? 'horizontal' : 'vertical',
              title: trans_zh['viewer.stat.recent_path'],
              formatter: () => {
                return (
                  <a className="ua blue" target="_blank" rel="noreferrer" href={recentHref}>
                    {data?.siteLastVisitedPathname || '-'}
                  </a>
                );
              },
            }}
          />
        </ProCard>
        <ProCard
          split={responsive ? 'horizontal' : 'vertical'}
          bordered
          style={{ marginBottom: responsive ? 8 : 0 }}
        >
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              layout: responsive ? 'horizontal' : 'vertical',
              title: (
                <TipTitle
                  title={trans_zh['viewer.stat.total_visitors']}
                  tip={trans_zh['viewer.stat.total_visitors.tip']}
                />
              ),
              value: data?.totalVisited || 0,
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              layout: responsive ? 'horizontal' : 'vertical',
              title: (
                <TipTitle
                  title={trans_zh['viewer.stat.total_views']}
                  tip={trans_zh['viewer.stat.total_views.tip']}
                />
              ),
              value: data?.totalViewer || 0,
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              layout: responsive ? 'horizontal' : 'vertical',
              title: (
                <TipTitle
                  title={trans_zh['viewer.stat.max_article_visitors']}
                  tip={trans_zh['viewer.stat.max_article_visitors.tip']}
                />
              ),
              value: data?.maxArticleVisited || 0,
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              layout: responsive ? 'horizontal' : 'vertical',
              title: (
                <TipTitle
                  title={trans_zh['viewer.stat.max_article_views']}
                  tip={trans_zh['viewer.stat.max_article_views.tip']}
                />
              ),
              value: data?.maxArticleViewer || 0,
            }}
          />
        </ProCard>
        <ProCard
          split={responsive ? 'horizontal' : 'vertical'}
          bordered={responsive ? false : true}
          ghost={responsive ? true : false}
          style={{ marginBottom: responsive ? 8 : 0 }}
        >
          <ProCard
            ghost
            colSpan={responsive ? 24 : 12}
            style={{ marginBottom: responsive ? 8 : 0 }}
          >
            <StatisticCard
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>{trans_zh['viewer.chart.recent_visit_top']}</div>
                  <NumSelect d="条" value={num} setValue={setNum} />
                </div>
              }
              className="card-full-title"
              chart={
                <div style={{ marginTop: -14 }}>
                  <ArticleList showRecentViewTime articles={data?.recentVisitArticles || []} />
                </div>
              }
            />
          </ProCard>
          <ProCard ghost colSpan={responsive ? 24 : 12}>
            <StatisticCard
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>{trans_zh['viewer.chart.article_views_top']}</div>
                  <NumSelect d="条" value={num} setValue={setNum} />
                </div>
              }
              className="card-full-title"
              chart={
                <div style={{ marginTop: -14 }}>
                  <ArticleList showViewerNum articles={data?.topViewer || []} />
                </div>
              }
            />
          </ProCard>
        </ProCard>
      </Spin>
    </RcResizeObserver>
  );
};

export default Viewer;
