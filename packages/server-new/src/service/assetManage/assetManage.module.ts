import { forwardRef, Module } from "@nestjs/common";
import { ImgController } from "./controller/img.controller";
import { LocalProvider } from "./provider/local.provider";
import { PicgoProvider } from "./provider/picgo.provider";
import { StaticProvider } from "./provider/static.provider";
import { MetaModule } from "../meta/meta.module";
import getFilterMongoSchemaObjs from "src/common/utils/filterMongoAllSchema";
import { ContentManagementModule } from "../contentManagement/contentManagement.module";


@Module({
  imports: [
    ...getFilterMongoSchemaObjs(),
    forwardRef(() => MetaModule),
    forwardRef(() => ContentManagementModule),
  ],
  controllers: [ImgController],
  providers: [
    LocalProvider,
    StaticProvider,
    PicgoProvider
  ],
})
export class AssetManageModule { }
