import { Injectable } from '@nestjs/common';
import {
  AnalyticsChartDataDto,
  DeviceStatsDto,
  BrowserStatsDto,
} from '../dto/analytics-response.dto';

export interface EchartsOption {
  title?: {
    text: string;
    subtext?: string;
  };
  tooltip?: Record<string, unknown>;
  legend?: {
    data: string[];
  };
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  series: unknown[];
}

@Injectable()
export class EchartsFormatterService {
  /**
   * Format time series data for line/area charts
   */
  formatTimeSeriesChart(data: AnalyticsChartDataDto): EchartsOption {
    return {
      title: {
        text: '访问趋势',
        subtext: '页面访问量与独立访客',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: '#6a7985',
          },
        },
      },
      legend: {
        data: ['页面访问量', '独立访客'],
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.pageviews.map((item) => item.time),
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: '页面访问量',
          type: 'line',
          smooth: true,
          data: data.pageviews.map((item) => item.value),
          areaStyle: {
            opacity: 0.3,
          },
        },
        {
          name: '独立访客',
          type: 'line',
          smooth: true,
          data: data.visitors.map((item) => item.value),
          areaStyle: {
            opacity: 0.3,
          },
        },
      ],
    };
  }

  /**
   * Format device stats for pie chart
   */
  formatDevicePieChart(data: DeviceStatsDto[]): EchartsOption {
    return {
      title: {
        text: '设备类型分布',
        subtext: '访问设备统计',
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)',
      },
      legend: {
        data: data.map((item) => item.device),
      },
      series: [
        {
          name: '设备类型',
          type: 'pie',
          radius: '50%',
          data: data.map((item) => ({
            value: item.count,
            name: item.device,
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  }

  /**
   * Format browser stats for horizontal bar chart
   */
  formatBrowserBarChart(data: BrowserStatsDto[]): EchartsOption {
    return {
      title: {
        text: '浏览器统计',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      xAxis: {
        type: 'value',
      },
      yAxis: {
        type: 'category',
        data: data.map((item) => item.browser),
      },
      series: [
        {
          name: '访问次数',
          type: 'bar',
          data: data.map((item) => item.count),
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  }

  /**
   * Format page rankings for bar chart
   */
  formatPageRankingsChart(data: Array<{ path: string; views: number }>): EchartsOption {
    return {
      title: {
        text: '热门页面',
        subtext: '访问量排行',
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
      },
      xAxis: {
        type: 'category',
        data: data.map((item) => item.path),
        axisLabel: {
          interval: 0,
          rotate: 30,
        },
      },
      yAxis: {
        type: 'value',
      },
      series: [
        {
          name: '访问量',
          type: 'bar',
          data: data.map((item) => item.views),
          itemStyle: {
            color: '#5470c6',
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }

  /**
   * Create a dashboard with multiple charts
   */
  formatDashboard(
    timeSeries: AnalyticsChartDataDto,
    devices: DeviceStatsDto[],
    browsers: BrowserStatsDto[],
  ): Record<string, EchartsOption> {
    return {
      timeSeries: this.formatTimeSeriesChart(timeSeries),
      devices: this.formatDevicePieChart(devices),
      browsers: this.formatBrowserBarChart(browsers),
    };
  }
}
