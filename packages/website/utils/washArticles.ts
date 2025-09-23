import type { Article } from '../types/article';

export type WashArticleKey = keyof Pick<Article, 'createdAt' | 'updatedAt' | 'category' | 'tags'>;

export type WashArticlesResult = Record<string, Article[]>;

export const washArticlesByKey = <K extends WashArticleKey>(
  rawArticles: Article[],
  getValueFn: (val: Article) => Article[K] | Article[K][],
  isKeyArray: boolean,
): WashArticlesResult => {
  const articles: WashArticlesResult = {};

  const values = Array.from(
    new Set(
      isKeyArray
        ? rawArticles.flatMap((a) => getValueFn(a) as Article[K][])
        : rawArticles.map((a) => getValueFn(a) as Article[K]),
    ),
  );

  for (const value of values) {
    const curArticles = rawArticles
      .filter((each) =>
        isKeyArray
          ? (getValueFn(each) as Article[K][]).includes(value as Article[K])
          : (getValueFn(each) as Article[K]) == value,
      )
      .sort(
        (prev, next) => new Date(next.createdAt).getTime() - new Date(prev.createdAt).getTime(),
      );

    articles[String(value)] = curArticles;
  }

  return articles;
};
