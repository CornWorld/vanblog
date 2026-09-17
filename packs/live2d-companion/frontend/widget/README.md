# Vendored: live2d-widgets 1.0.1

- 来源:https://github.com/stevenjoezhang/live2d-widget(npm `live2d-widgets@1.0.1`)
- 许可:GPL-3.0(见 LICENSE;与本仓根 LICENSE 同族,合规)
- 内容:`autoload.js` / `live2d.min.js` / `waifu.css` / `waifu-tips.js` /
  `waifu-tips.json` / `chunk/`(ESM 动态分块)
- 本地化补丁:`autoload.js` 顶部的 `live2d_path` 由硬编码 jsdelivr URL 改为
  `new URL('.', document.currentScript.src).href`——兄弟文件按相对路径加载,
  因此本目录必须以**未哈希原样路径**服役(pack.json `frontend.static` 机制,
  构建 `pack-static/live2d-companion/widget/`,见 app/integrations/packs/index.mjs)。
- 升级:换版本时整目录替换,重打上面的补丁,同步 pack.json 无需改动。
- 模型资产(live2d_api)不在本目录:体积大、授权复杂,走 CDN
  (`cdnPath`),失败时静默降级(无模型但有工具/提示)。
