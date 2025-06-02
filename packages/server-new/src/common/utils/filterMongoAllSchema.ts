import {
  Article,
  ArticleSchema,
  Category,
  CategorySchema,
  CustomPage,
  CustomPageSchema,
  Draft,
  DraftSchema,
  Meta,
  MetaSchema,
  Pipeline,
  PipelineSchema,
  Setting,
  SettingSchema,
  Static,
  StaticSchema,
  Token,
  TokenSchema,
  User,
  UserSchema,
  Viewer,
  ViewerSchema,
  Visit,
  VisitSchema,
} from 'src/scheme';

import { config } from 'src/common/config';
import { MongooseModule } from '@nestjs/mongoose';

const ALL_SCHEMAS_OBJS = [
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
];

type SchemaObj = (typeof ALL_SCHEMAS_OBJS)[number] | undefined | null;

export default function getFilterMongoSchemaObjs(mySchema?: SchemaObj) {
  return [
    MongooseModule.forRoot(config.mongoUrl, {
      autoIndex: true,
    }),
    MongooseModule.forFeature(ALL_SCHEMAS_OBJS.filter((schemaOobj) => schemaOobj !== mySchema)),
  ];
}
