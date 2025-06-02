import { forwardRef, Module } from '@nestjs/common';
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
import { AnalysisModule } from 'src/service/analysis/analysis.module';
import { AssetManageModule } from 'src/service/assetManage/assetManage.module';
import { AuthModule } from 'src/service/auth/auth.module';

import { InfraModule } from 'src/infra/infra.module';
import { MarkdownProvider } from './provider/markdown.provider';
import { MetaModule } from '../meta/meta.module';
import { IsrModule } from '../isr/isr.module';

@Module({
  imports: [

    forwardRef(() => AnalysisModule),
    forwardRef(() => AssetManageModule),
    forwardRef(() => AuthModule),
    forwardRef(() => MetaModule),
    forwardRef(() => IsrModule),
    ...getFilterMongoSchemaObjs(),

    InfraModule,
  ],
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
    MarkdownProvider
  ],
  exports: [
    ArticleProvider,
    CategoryProvider,
    DraftProvider,
    TagProvider,
    CustomPageProvider,
    PipelineProvider,
    MarkdownProvider
  ]
})
export class ContentManagementModule { }
