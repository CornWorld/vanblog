import { client } from '../client';

export const categoryService = {
  getCategories: client.getCategories,
  createCategory: client.createCategory,
  updateCategory: client.updateCategory,
  deleteCategory: client.deleteCategory,
  getArticlesByCategory: client.getArticlesByCategory,
  getPublicCategories: client.getPublicCategories,
};
