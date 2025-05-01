import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { Spin } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getWelcomeData } from '@/services/van-blog/api';
import ArticleList from '@/components/ArticleList';
import { getRecentTimeDes } from '@/services/van-blog/tool';
import { Link } from '@/router';
import TipTitle from '@/components/TipTitle';
import '../index.less';
import NumSelect from '@/components/NumSelect';
import { useNum } from '@/services/van-blog/useNum';
import RcResizeObserver from 'rc-resize-observer';

const Viewer = () => {
  const { t } = useTranslation();
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
                  {t('viewer.stat.baidu')}
                </a>
              ),
              formatter: () => {
                if (data?.enableBaidu) {
                  return <span>{t('viewer.stat.enabled')}</span>;
                } else {
                  return (
                    <Link to={`/admin/site/setting?siteInfoTab=more`}>
                      {t('viewer.stat.unconfigured')}
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
                  {t('viewer.stat.google')}
                </a>
              ),
              formatter: () => {
                if (data?.enableGA) {
                  return <span>{t('viewer.stat.enabled')}</span>;
                } else {
                  return (
                    <Link to={`/admin/site/setting?siteInfoTab=more`}>
                      {t('viewer.stat.unconfigured')}
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
              title: t('viewer.stat.recent_visit'),
              value: recentVisitTime,
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              layout: responsive ? 'horizontal' : 'vertical',
              title: t('viewer.stat.recent_path'),
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
                  title={t('viewer.stat.total_visitors')}
                  tip={t('viewer.stat.total_visitors.tip')}
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
                  title={t('viewer.stat.total_views')}
                  tip={t('viewer.stat.total_views.tip')}
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
                  title={t('viewer.stat.max_article_visitors')}
                  tip={t('viewer.stat.max_article_visitors.tip')}
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
                  title={t('viewer.stat.max_article_views')}
                  tip={t('viewer.stat.max_article_views.tip')}
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
                  <div>{t('viewer.chart.recent_visit_top')}</div>
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
                  <div>{t('viewer.chart.article_views_top')}</div>
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
