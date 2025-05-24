import { Module } from "@nestjs/common";
import { AnalysisController } from "./controller/analysis.controller";
import { AnalysisProvider } from "./provider/analysis.provider";
import { ViewerProvider } from "./provider/viewer.provider";
import { VisitProvider } from "./provider/visit.provider";
import { WalineProvider } from "./provider/waline.provider";

@Module({
    imports: [],
    controllers: [AnalysisController],
    providers: [AnalysisProvider, ViewerProvider, VisitProvider, WalineProvider],
})
export class AssetManageModule { }