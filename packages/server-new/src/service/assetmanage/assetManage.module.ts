import { Module } from "@nestjs/common";
import { ImgController } from "./controller/img.controller";
import { LocalProvider } from "./provider/local.provider";
import { PicgoProvider } from "./provider/picgo.provider";
import { StaticProvider } from "./provider/static.provider";
import { MetaModule } from "../meta/meta.module";
import getFilterMongoSchemaObjs from "src/common/utils/filterMongoAllSchema";
import { AnalysisModule } from "../analysis/analysis.module";
import { AuthModule } from "../auth/auth.module";
import { ContentManagementModule } from "../contentManagement/contentManagement.module";
import { IsrModule } from "../isr/isr.module";
import { WalineModule } from "../waline/waline.module";


@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    MetaModule,
    AnalysisModule,
    AuthModule,
    ContentManagementModule,
    IsrModule,
    WalineModule
  ],
  controllers: [ImgController],
  providers: [
    LocalProvider,
    StaticProvider,
    PicgoProvider
  ],
})
export class AssetManageModule { }
