import { Module } from "@nestjs/common";
import { AnalysisController } from "./controller/analysis.controller";
import { AnalysisProvider } from "./provider/analysis.provider";
import { ViewerProvider } from "./provider/viewer.provider";
import { VisitProvider } from "./provider/visit.provider";
import { WalineProvider } from "./provider/waline.provider";
import { MetaModule } from "../meta/meta.module";
import getFilterMongoSchemaObjs from "src/common/utils/filterMongoAllSchema";
import { ContentManagementModule } from "../contentManagement/contentManagement.module";

@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    MetaModule,
    ContentManagementModule
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
