import { Module } from "@nestjs/common";
import { AnalysisController } from "./controller/analysis.controller";
import { AnalysisProvider } from "./provider/analysis.provider";
import { ViewerProvider } from "./provider/viewer.provider";
import { VisitProvider } from "./provider/visit.provider";
import { WalineProvider } from "./provider/waline.provider";
import { MetaModule } from "../meta/meta.module";
import { AssetManageModule } from "../assetManage/assetManage.module";
import getFilterMongoSchemaObjs from "src/common/utils/filterMongoAllSchema";

@Module({
  imports: [
    MetaModule,
    AssetManageModule,
    ...getFilterMongoSchemaObjs()
  ],
  controllers: [AnalysisController],
  providers: [
    AnalysisProvider,
    ViewerProvider,
    VisitProvider,
    WalineProvider
  ],
})
export class AnalysisModule { }
