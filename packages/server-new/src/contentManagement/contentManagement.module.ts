import { Module } from '@nestjs/common';
import { ArticleController } from './controller/article.controller';
import { CategoryController } from './controller/category.controller';
import { CustomPageController } from './controller/customPage.controller';
import { DraftController } from './controller/draft.controller';
import { TagController } from './controller/tag.controller';
import { ArticleProvider } from './provider/article.provider';
import { CategoryProvider } from './provider/category.provider';
import { CustomPageProvider } from './provider/customPage.provider';
import { DraftProvider } from './provider/draft.provider';
import { TagProvider } from './provider/tag.provider';
@Module({
  imports: [],
  controllers: [
    ArticleController,
    CategoryController,
    DraftController,
    TagController,
    CustomPageController,
  ],
  providers: [ArticleProvider, CategoryProvider, DraftProvider, TagProvider, CustomPageProvider],
})
export class ContentManagementModule {}
