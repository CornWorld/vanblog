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

const trans_zh = {
  'overview.statistic.article_count': '文章数',
  'overview.statistic.word_count': '总字数',
  'overview.statistic.total_visitors': '总访客数',
  'overview.statistic.total_visitors.tip':
    '以浏览器内缓存的唯一标识符为衡量标准计算全站独立访客的数量',
  'overview.statistic.today_new': '今日新增',
  'overview.statistic.total_views': '总访问数',
  'overview.statistic.total_views.tip': '以每一次页面的访问及跳转为衡量标准计算全站的访问数量',
  'overview.chart.visitors_trend': '访客数趋势图',
  'overview.chart.views_trend': '访问量趋势图',
  'overview.chart.total_visitors_trend': '总访客数趋势图',
  'overview.chart.total_views_trend': '总访问量趋势图',
  'overview.chart.visitors': '访客数',
  'overview.chart.views': '访问量',
};

const OverView = () => {
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
        [trans_zh['overview.chart.visitors']]: each.visited,
        [trans_zh['overview.chart.views']]: each.viewer,
      });
    }
    return res;
  }, [data]);

  const totalData = useMemo(() => {
    const res = [];
    for (const each of data?.viewer?.grid?.total || []) {
      res.push({
        date: each.date,
        [trans_zh['overview.chart.visitors']]: each.visited,
        [trans_zh['overview.chart.views']]: each.viewer,
      });
    }
    return res;
  }, [data]);
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
              title: trans_zh['overview.statistic.article_count'],
              value: data?.total?.articleNum || 0,
              layout: responsive ? 'horizontal' : 'vertical',
            }}
          />
          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: trans_zh['overview.statistic.word_count'],
              layout: responsive ? 'horizontal' : 'vertical',
              value: data?.total?.wordCount || 0,
            }}
          />

          <StatisticCard
            colSpan={responsive ? 24 : 6}
            statistic={{
              title: (
                <TipTitle
                  title={trans_zh['overview.statistic.total_visitors']}
                  tip={trans_zh['overview.statistic.total_visitors.tip']}
                />
              ),
              value: data?.viewer?.now?.visited || 0,
              layout: responsive ? 'horizontal' : 'vertical',
              description: (
                <Statistic
                  title={trans_zh['overview.statistic.today_new']}
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
                  title={trans_zh['overview.statistic.total_views']}
                  tip={trans_zh['overview.statistic.total_views.tip']}
                />
              ),
              layout: responsive ? 'horizontal' : 'vertical',
              value: data?.viewer?.now?.viewer || 0,
              description: (
                <Statistic
                  title={trans_zh['overview.statistic.today_new']}
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
                <div>{trans_zh['overview.chart.visitors_trend']}</div>
                <NumSelect d="天" value={num} setValue={setNum} />
              </div>
            }
            chart={<Area yField={trans_zh['overview.chart.visitors']} {...eachConfig} />}
          />

          <StatisticCard
            colSpan={!responsive ? 12 : 24}
            className="card-full-title"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{trans_zh['overview.chart.views_trend']}</div>
                <NumSelect d="天" value={num} setValue={setNum} />
              </div>
            }
            chart={<Area yField={trans_zh['overview.chart.views']} {...eachConfig} />}
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
                <div>{trans_zh['overview.chart.total_visitors_trend']}</div>
                <NumSelect d="天" value={num} setValue={setNum} />
              </div>
            }
            chart={<Area yField={trans_zh['overview.chart.visitors']} {...lineConfig} />}
          />

          <StatisticCard
            colSpan={!responsive ? 12 : 24}
            className="card-full-title"
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{trans_zh['overview.chart.total_views_trend']}</div>
                <NumSelect d="天" value={num} setValue={setNum} />
              </div>
            }
            chart={<Area yField={trans_zh['overview.chart.views']} {...lineConfig} />}
          />
        </ProCard>
      </Spin>
    </RcResizeObserver>
  );
};

export default OverView;
