export interface Article {
  id: string;
  title: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  pathname?: string;
  category: string;
  tags: string[];
  top: boolean | number;
  hide: boolean;
  secret: boolean;
  private: boolean;
  copyright?: string;
  content?: string;
  summary?: string;
  wordCount?: number;
  viewer?: number;
}
