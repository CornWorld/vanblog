/**
 * Reading Time Plugin
 *
 * Estimates article reading time based on word count and displays it
 * in articles and provides data to frontend.
 */

import type { PluginAPI } from '@vanblog/shared/plugin';

interface ReadingTimeStats {
  totalArticles: number;
  averageReadTime: number;
  shortestReadTime: number;
  longestReadTime: number;
}

export default (api: PluginAPI) => {
  // Check if plugin is enabled
  const enabled = api.config.enabled as boolean;
  if (!enabled) {
    api.log.warn('Reading Time Plugin is disabled');
    return;
  }

  const wordsPerMinute = (api.config.wordsPerMinute as number) || 200;
  const showInArticle = api.config.showInArticle as boolean;

  api.log.info(`Reading Time Plugin loaded (${wordsPerMinute} words/min)`);

  // Store statistics
  const stats = api.store<ReadingTimeStats>('stats', {
    totalArticles: 0,
    averageReadTime: 0,
    shortestReadTime: Infinity,
    longestReadTime: 0,
  });

  /**
   * Calculate reading time from content
   */
  const calculateReadingTime = (content: string): number => {
    // Remove markdown syntax and count words
    const text = content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
      .replace(/[#*_~`]/g, '') // Remove markdown symbols
      .trim();

    // Count Chinese characters and English words
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;

    // Estimate total words (Chinese chars count as 1 word)
    const totalWords = chineseChars + englishWords;

    // Calculate minutes
    const minutes = Math.ceil(totalWords / wordsPerMinute);

    return Math.max(1, minutes); // At least 1 minute
  };

  /**
   * Update statistics
   */
  const updateStats = (readTime: number) => {
    stats.value.totalArticles += 1;
    stats.value.shortestReadTime = Math.min(stats.value.shortestReadTime, readTime);
    stats.value.longestReadTime = Math.max(stats.value.longestReadTime, readTime);

    // Calculate average
    const totalTime = stats.value.averageReadTime * (stats.value.totalArticles - 1) + readTime;
    stats.value.averageReadTime = Math.round(totalTime / stats.value.totalArticles);
  };

  // Hook: Calculate and store reading time when article is created
  api.filter('article|beforeCreate', (article: any) => {
    const readTime = calculateReadingTime(article.content);

    // Store in article metadata (if your Article type supports it)
    // article.readingTime = readTime;

    updateStats(readTime);
    api.log.debug(`Article reading time: ${readTime} min`);

    return article;
  });

  // Hook: Recalculate reading time when article is updated
  api.filter('article|beforeUpdate', (article: any) => {
    const readTime = calculateReadingTime(article.content);

    // article.readingTime = readTime;

    api.log.debug(`Updated reading time: ${readTime} min`);
    return article;
  });

  // Hook: Add reading time indicator to article content (if enabled)
  if (showInArticle) {
    api.filter('markdown|render', (content: string) => {
      const readTime = calculateReadingTime(content);
      const indicator = `\n\n---\n\n📖 预计阅读时长：**${readTime} 分钟**\n\n---\n\n`;
      return indicator + content;
    });
  }

  // Shortcode: Display reading time
  api.shortcode('read-time', (attrs: any, content: string | null) => {
    const readTime = calculateReadingTime(content || '');
    const emoji = attrs.emoji || '📖';
    const format = attrs.format || 'minutes';

    let display: string;
    if (format === 'seconds') {
      display = `${readTime * 60} 秒`;
    } else if (format === 'hours') {
      const hours = (readTime / 60).toFixed(1);
      display = `${hours} 小时`;
    } else {
      display = `${readTime} 分钟`;
    }

    return `<span class="read-time">${emoji} ${display}</span>`;
  });

  // Provide public data for frontend
  api.provide('readingTime', () => ({
    stats: stats.value,
    config: {
      wordsPerMinute,
      showInArticle,
    },
  }));

  // Lifecycle: Log activation
  api.onActivate(() => {
    api.log.info('Reading Time Plugin activated');
    api.log.debug('Current stats:', stats.value);
  });

  // Lifecycle: Log deactivation
  api.onDeactivate(() => {
    api.log.info('Reading Time Plugin deactivated');
  });

  // Config change: Update words per minute
  api.onConfigChange('wordsPerMinute', (newValue) => {
    api.log.info('Reading speed updated:', newValue);
  });

  api.onConfigChange('showInArticle', (newValue) => {
    api.log.info('Show in article updated:', newValue);
  });
};
