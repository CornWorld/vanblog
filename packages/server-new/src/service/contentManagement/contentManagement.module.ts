import { Module } from '@nestjs/common';
import { ArticleController } from './controller/article.controller';
import { CategoryController } from './controller/category.controller';
import { CustomPageController } from './controller/customPage.controller';
import { DraftController } from './controller/draft.controller';
import { TagController } from './controller/tag.controller';
import { CollaboratorController } from './controller/collaborator.controller';
import { PipelineController } from './controller/pipeline.controller';
import { ArticleProvider } from './provider/article.provider';
import { CategoryProvider } from './provider/category.provider';
import { CustomPageProvider } from './provider/customPage.provider';
import { DraftProvider } from './provider/draft.provider';
import { TagProvider } from './provider/tag.provider';
import { PipelineProvider } from './provider/pipeline.provider';
import getFilterMongoSchemaObjs from 'src/common/utils/filterMongoAllSchema';

@Module({
  imports: [...getFilterMongoSchemaObjs()],
  controllers: [
    ArticleController,
    CategoryController,
    DraftController,
    TagController,
    CustomPageController,
    CollaboratorController,
    PipelineController,
  ],
  providers: [
    ArticleProvider,
    CategoryProvider,
    DraftProvider,
    TagProvider,
    CustomPageProvider,
    PipelineProvider,
  ],
})
export class ContentManagementModule {}
