import { Module } from "@nestjs/common";
import { ImgController } from "./controller/img.controller";
import { LocalProvider } from "./provider/local.provider";
import { PicgoProvider } from "./provider/picgo.provider";
import { StaticProvider } from "./provider/static.provider";
@Module({
  imports: [],
  controllers: [ImgController],
  providers: [
    LocalProvider,
    StaticProvider,
    PicgoProvider
  ],
})
export class AssetManageModule { }