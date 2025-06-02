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
import { IsrModule } from 'src/service/isr/isr.module';
import { MetaModule } from 'src/service/meta/meta.module';

import { InfraModule } from 'src/infra/infra.module';

@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),

    forwardRef(() => AnalysisModule),
    forwardRef(() => AssetManageModule),
    AuthModule,
    forwardRef(() => IsrModule),
    forwardRef(() => MetaModule),

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
  ],
})
export class ContentManagementModule { }
