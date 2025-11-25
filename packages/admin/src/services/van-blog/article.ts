import { client } from '../client';

export const articleService = {
  getAdminArticles: client.getAdminArticles,
  createArticle: client.createArticle,
  updateArticle: client.updateArticle,
  deleteArticle: client.deleteArticle,
  getAdminArticle: client.getAdminArticle,
  searchAdminArticles: client.searchAdminArticles,
  getPublicArticles: client.getPublicArticles,
  getPublicArticle: client.getPublicArticle,
  getEncryptedArticle: client.getEncryptedArticle,
  getPublicTimeline: client.getPublicTimeline,
  searchPublicArticles: client.searchPublicArticles,
};
