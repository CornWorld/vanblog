import type { Article } from '../types/article';

export const getArticlesKeyWord = (articles: Article[]) => {
  // 文章标签分类生成 keywords
  try {
    const keywords: string[] = [];
    for (const a of articles) {
      const ts = a.tags || [];
      for (const t of ts) {
        if (!keywords.includes(t)) {
          keywords.push(t);
        }
      }
      if (a.category && !keywords.includes(a.category)) {
        keywords.push(a.category);
      }
    }
    return keywords;
  } catch {
    return [];
  }
};
