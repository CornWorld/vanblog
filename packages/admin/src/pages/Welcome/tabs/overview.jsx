import React from 'react';
import { useTranslation } from 'react-i18next';
import { Area } from '@ant-design/plots';
import { ProCard, StatisticCard } from '@ant-design/pro-components';
import { Spin } from 'antd';
import { getWelcomeData } from '@/services/van-blog/api';
import NumSelect from '@/components/NumSelect';
import RcResizeObserver from 'rc-resize-observer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import '../index.less';
import TipTitle from '@/components/TipTitle';
import { useNum } from '@/services/van-blog/useNum';
const { Statistic } = StatisticCard;

const OverView = () => {
  const { t } = useTranslation();
  const [data, setData] = useState();
  const [loading, setLoading] = useState(true);
  const [num, setNum] = useNum(5);
  const [responsive, setResponsive] = useState(false);
  const fetchData = useCallback(async () => {
    const { data: res } = await getWelcomeData('overview', num);
    setData(res);
  }, [setData, num]);
  useEffect(() => {
    setLoading(true);
    fetchData().then(() => {
      setLoading(false);
    });
  }, [fetchData, setLoading]);

  const eachData = useMemo(() => {
    const res = [];
    for (const each of data?.viewer?.grid?.each || []) {
      res.push({
        date: each.date,
        [t('overview.chart.visitors')]: each.visited,
        [t('overview.chart.views')]: each.viewer,
      });
    }
    return res;
  }, [data, t]);

  const totalData = useMemo(() => {
    const res = [];
    for (const each of data?.viewer?.grid?.total || []) {
      res.push({
        date: each.date,
        [t('overview.chart.visitors')]: each.visited,
        [t('overview.chart.views')]: each.viewer,
      });
    }
    return res;
  }, [data, t]);
  const lineConfig = {
    data: totalData,
    xField: 'date',
    // autoFit: true,
    height: 200,
  };
  const eachConfig = {
    data: eachData,
    xField: 'date',
    height: 200,
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
          split={responsive ? 'horizontal' : 'vertical'}
          bordered
          style={{ marginBottom: responsive ? 8 : 0 }}
        >
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: t('overview.statistic.article_count'),
              value: data?.total?.articleNum || 0,
              layout: responsive ? 'horizontal' : 'vertical',
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: t('overview.statistic.word_count'),
              layout: responsive ? 'horizontal' : 'vertical',
              value: data?.total?.wordCount || 0,
            }}
          />

          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: (
                <TipTitle
                  title={t('overview.statistic.total_visitors')}
                  tip={t('overview.statistic.total_visitors.tip')}
                />
              ),
              value: data?.viewer?.now?.visited || 0,
              layout: responsive ? 'horizontal' : 'vertical',
              description: (
                <Statistic
                  title={t('overview.statistic.today_new')}
                  value={data?.viewer?.add?.visited || 0}
                  trend="up"
                />
              ),
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: (
                <TipTitle
                  title={t('overview.statistic.total_views')}
                  tip={t('overview.statistic.total_views.tip')}
                />
              ),
              layout: responsive ? 'horizontal' : 'vertical',
              value: data?.viewer?.now?.viewer || 0,
              description: (
                <Statistic
                  title={t('overview.statistic.today_new')}
                  value={data?.viewer?.add?.viewer || 0}
                  trend="up"
                />
              ),
            }}
          />
        </ProCard>
        <ProCard
          bordered={responsive ? false : true}
          split={responsive ? 'horizontal' : 'vertical'}
          ghost={responsive ? true : false}
        >
          <StatisticCard
            style={{ marginBottom: responsive ? 8 : 0 }}
            colSpan={!responsive ? 12 : 24}
            className="card-full-title"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{t('overview.chart.visitors_trend')}</div>
                <NumSelect d="天" value={num} setValue={setNum} />
              </div>
            }
            chart={<Area yField={t('overview.chart.visitors')} {...eachConfig} />}
          />

          <StatisticCard
            colSpan={!responsive ? 12 : 24}
            className="card-full-title"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{t('overview.chart.views_trend')}</div>
                <NumSelect d="天" value={num} setValue={setNum} />
              </div>
            }
            chart={<Area yField={t('overview.chart.views')} {...eachConfig} />}
          />
        </ProCard>
        <ProCard
          bordered={responsive ? false : true}
          split={responsive ? 'horizontal' : 'vertical'}
          ghost={responsive ? true : false}
        >
          <StatisticCard
            style={{ marginBottom: responsive ? 8 : 0 }}
            colSpan={!responsive ? 12 : 24}
            className="card-full-title"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{t('overview.chart.total_visitors_trend')}</div>
                <NumSelect d="天" value={num} setValue={setNum} />
              </div>
            }
            chart={<Area yField={t('overview.chart.visitors')} {...lineConfig} />}
          />

          <StatisticCard
            colSpan={!responsive ? 12 : 24}
            className="card-full-title"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{t('overview.chart.total_views_trend')}</div>
                <NumSelect d="天" value={num} setValue={setNum} />
              </div>
            }
            chart={<Area yField={t('overview.chart.views')} {...lineConfig} />}
          />
        </ProCard>
      </Spin>
    </RcResizeObserver>
  );
};

export default OverView;
