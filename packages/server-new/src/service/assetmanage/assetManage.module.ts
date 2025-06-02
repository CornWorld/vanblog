import { forwardRef, Module } from "@nestjs/common";
import { ImgController } from "./controller/img.controller";
import { LocalProvider } from "./provider/local.provider";
import { PicgoProvider } from "./provider/picgo.provider";
import { StaticProvider } from "./provider/static.provider";
import getFilterMongoSchemaObjs from "src/common/utils/filterMongoAllSchema";
import { AuthModule } from "../auth/auth.module";
import { MetaModule } from "../meta/meta.module";
import { ContentManagementModule } from "../contentManagement/contentManagement.module";
import { AnalysisModule } from "../analysis/analysis.module";


@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => MetaModule),
    forwardRef(() => ContentManagementModule),
    forwardRef(() => AnalysisModule),
    ...getFilterMongoSchemaObjs(),
  ],
  controllers: [ImgController],
  providers: [
    LocalProvider,
    StaticProvider,
    PicgoProvider,
  ],
  exports: [
    LocalProvider,
    StaticProvider,
    PicgoProvider
  ]
})
export class AssetManageModule { }
