import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { initJwt } from './common/utils/initJwt';
import { config } from './common/config';
import { Article, ArticleSchema } from './scheme/article/article.schema';
import { Draft, DraftSchema } from './scheme/article/draft.schema';
import { Meta, MetaSchema } from './scheme/meta/meta.schema';
import { User, UserSchema } from './scheme/user/user.schema';
import { Viewer, ViewerSchema } from './scheme/assetmanage/viewer.schema';
import { Visit, VisitSchema } from './scheme/assetmanage/visit.schema';
import { Setting, SettingSchema } from './scheme/setting.schema';
import { Static, StaticSchema } from './scheme/static.schema';
import { CustomPage, CustomPageSchema } from './scheme/customPage.schema';
import { Token, TokenSchema } from './scheme/user/token.schema';
import { Category, CategorySchema } from './scheme/article/category.schema';
import { Pipeline, PipelineSchema } from './scheme/pipeline.schema';

import { ServiceModule } from './service/service.module';
import { InfraModule } from './infra/infra.module';

@Module({
  imports: [
    MongooseModule.forRoot(config.mongoUrl, {
      autoIndex: true,
    }),
    MongooseModule.forFeature([
      { name: Article.name, schema: ArticleSchema },
      { name: Draft.name, schema: DraftSchema },
      { name: Meta.name, schema: MetaSchema },
      { name: User.name, schema: UserSchema },
      { name: Viewer.name, schema: ViewerSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: Setting.name, schema: SettingSchema },
      { name: Static.name, schema: StaticSchema },
      { name: CustomPage.name, schema: CustomPageSchema },
      { name: Token.name, schema: TokenSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Pipeline.name, schema: PipelineSchema },
    ]),
    JwtModule.registerAsync({
      useFactory: async () => {
        return {
          secret: await initJwt(),
          signOptions: {
            expiresIn: 3600 * 24 * 7,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    ServiceModule,
    InfraModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
