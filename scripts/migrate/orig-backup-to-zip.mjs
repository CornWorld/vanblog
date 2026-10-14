#!/usr/bin/env node
// orig-backup-to-zip.mjs — 原版 mereithhh/van-blog 备份 → 本仓导入 ZIP。
//
// 输入:
//   1. 原版后台「数据备份」下载的 JSON(结构: {articles,tags,meta,drafts,
//      categories,user,viewer,visit,static,setting}),来自
//      GET /api/admin/backup/export(原版)。
//   2. 可选:原版后台「图片管理 → 导出全部图片」下载的 img ZIP(本地图床才有;
//      用 S3/PicGo 图床的站不带 --img-zip,图片链接保持外链不动)。
//
// 输出: 一个目录,内含
//   posts.json                       — migrationschema.Post 数组(vault/internal/migrationschema)
//   images/<key>/<原文件名>           — 文章正文引用到的图片字节
// 之后 `cd <outdir> && zip -r ../vanblog-import.zip .` 即得可上传的导入包。
//
// 映射规则:
//   article.hidden=true  → status "hidden";其余 "published"
//   article.deleted=true → 跳过(先在原版回收站恢复需要的文章再重新导出)
//   drafts               → 跳过(原版草稿箱与文章集合分离,需在原版先发布)
//   /static/img/<name> 与
//   <picDomain>/img/<name> 等 img 引用 → 改写为 /api/files/<key>/<name>,
//                                        字节放入 images/<key>/<name>
//   分类/标签按名字原样保留(导入端按名字 resolve-or-create)
//
// 用法:
//   node orig-backup-to-zip.mjs --backup 原版备份.json [--img-zip 图片包.zip] --out ./out
//
// 仅用 Node 内置模块(zip 读用 zlib inflateRaw + 手解 local file header),
// 无第三方依赖;Node >= 18。

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { join, resolve, basename } from "node:path";

const argv = process.argv.slice(2);
function arg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const backupPath = arg("--backup");
const imgZipPath = arg("--img-zip");
const outDir = arg("--out") || "./orig-import-out";
if (!backupPath) {
  console.error("用法: node orig-backup-to-zip.mjs --backup <原版备份.json> [--img-zip <图片包.zip>] --out <输出目录>");
  process.exit(2);
}

// ---------- zip 读(仅支持 store/deflate,原版导出即此两种) ----------

function readZipEntries(buf) {
  // 定位 End of Central Directory
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("不是有效的 ZIP(找不到 EOCD)");
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error("central directory 损坏");
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const lho = buf.readUInt32LE(ptr + 42);
    const name = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString("utf8");
    // local header: 30 字节固定 + name + extra
    const lNameLen = buf.readUInt16LE(lho + 26);
    const lExtraLen = buf.readUInt16LE(lho + 28);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
    if (data) entries.set(name, data);
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------- 图片索引: name(不含路径) → bytes ----------

const images = new Map(); // "name" -> Buffer
if (imgZipPath) {
  const zipBuf = readFileSync(resolve(imgZipPath));
  for (const [name, data] of readZipEntries(zipBuf)) {
    if (name.endsWith("/")) continue;
    images.set(basename(name), data);
  }
  console.error(`图片包: 读入 ${images.size} 个文件`);
} else {
  console.error("未提供 --img-zip:正文图片链接将保持原样(外链/S3 不受影响;本地图床图片会 404)");
}

// ---------- 读取原版备份 ----------

const raw = JSON.parse(readFileSync(resolve(backupPath), "utf8"));
const articles = Array.isArray(raw.articles) ? raw.articles : [];
console.error(`原版备份: ${articles.length} 篇文章(含回收站)`);

// ---------- 转换 ----------

const skipDeleted = [];
const outPosts = [];
const usedKeys = new Set();
const keyByFile = new Map(); // 同一文件多处引用 → 复用同一 key,不重复打包字节
let imgRewrites = 0;
let imgMissing = 0;

function imgKeyFor(name) {
  const known = keyByFile.get(name);
  if (known) return known;
  // 用文件名本身做 key 一段路径;/api/files/<key> 与 zip images/<key> 对齐
  let key = name.replace(/[/\\]/g, "_");
  if (usedKeys.has(key)) {
    let i = 2;
    while (usedKeys.has(`${key}_${i}`)) i++;
    key = `${key}_${i}`;
  }
  usedKeys.add(key);
  keyByFile.set(name, key);
  return key;
}

// 原版图片引用形态:
//   <img src="/static/img/xxx.png">            (dev/本地相对路径)
//   <img src="https://pic.xx.com/img/xxx.png"> (配置了图床域名)
//   <img src="/img/xxx.png">                   (prod favicon 类 toRootPath,罕见)
const IMG_REF = /(?:\/static\/img\/|\/img\/)([A-Za-z0-9._-]+)\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)/gi;

for (const a of articles) {
  if (a.deleted) { skipDeleted.push(a.title || a.pathname || a.id); continue; }

  let content = typeof a.content === "string" ? a.content : "";
  content = content.replace(IMG_REF, (match, stem, ext) => {
    const fileName = `${stem}.${ext}`;
    const bytes = images.get(fileName);
    if (!bytes) { imgMissing++; return match; } // 无字节 → 链接原样保留
    const key = imgKeyFor(fileName);
    mkdirSync(join(outDir, "images", key), { recursive: true });
    writeFileSync(join(outDir, "images", key, fileName), bytes);
    imgRewrites++;
    return `/api/files/${key}/${fileName}`;
  });

  outPosts.push({
    id: String(a.id ?? ""),
    title: a.title ?? "",
    content,
    status: a.hidden ? "hidden" : "published",
    pathname: a.pathname ?? "",
    private: !!a.private,
    password: a.password ?? "",
    top: Number(a.top ?? 0),
    copyright: a.copyright ?? "",
    category: a.category ?? "",
    tags: Array.isArray(a.tags) ? a.tags.filter(Boolean) : [],
    created: a.createdAt ?? "",
    updated: a.updatedAt ?? "",
  });
}

// ---------- 落盘 ----------

mkdirSync(join(outDir, "images"), { recursive: true });
writeFileSync(join(outDir, "posts.json"), JSON.stringify(outPosts, null, 2));

const draftCount = Array.isArray(raw.drafts) ? raw.drafts.length : 0;

console.error(``);
console.error(`转换完成 → ${outDir}`);
console.error(`  文章: ${outPosts.length}(回收站跳过 ${skipDeleted.length},草稿不迁移: ${draftCount})`);
console.error(`  图片改写: ${imgRewrites}(无字节保留原链 ${imgMissing})`);
console.error(`下一步:`);
console.error(`  cd ${outDir} && zip -r ../vanblog-import.zip .`);
console.error(`  然后在新版后台「数据迁移」上传 vanblog-import.zip`);
console.error(`  (导入接口上限 100MB;图片包很大时先确认打包后体积)`);
if (skipDeleted.length) {
  console.error(`跳过的回收站文章: ${skipDeleted.join(" / ")}`);
}
