# HOME-CSS-EVIDENCE — askclaw 首页 CSS 补齐 / 构建 / 部署 / 真浏览器验收

任务: kanban `t_01cae686`
工作区: `/home/computebox/2609/askclaw.dev-astro` (branch `feat/astro-batch2`)
观察时间: 2026-09-19 UTC (所有时间戳见下方命令日志)
部署目标: `26430:/var/www/askclaw-site/astro-preview/`
公开预览: `https://askclaw.dev/astro-preview/`

真源 (直接读取,未修改):

| 文件 | sha256 |
|---|---|
| `~/2609/askclaw-design-05/mockups/01-hero-questions-4-desktop.svg` | `95cf0dbfbb5ef05b3a5127204a0491bc8ece99a1ea7da5fec4268a794a82ef28` |
| `~/2609/askclaw-design-05/mockups/02-hero-questions-4-mobile.svg` | `daaa9a92ec99a8189c353b25029df5a4c4bfdb6a2504f38bc779e4ef2f9732fe` |
| `~/2609/askclaw-design-05/mockups/03-pending-section.svg` | `71d6ecfb1b4fd494ff18a15dec6103e64c826d9a31b1a945754ece4c24c118f3` |

## 1. 追加-only 证明

`git diff --numstat -- src/styles/global.css` → `771  0  src/styles/global.css`
= **新增 771 行,删除 0 行**。`git diff` 中 `^-[^-]` 计数 = **0**。

前 493 行与原文件字节相同 (cmp 通过):

```
head -493 src/styles/global.css > /tmp/head493.css
cmp /tmp/head493.css /tmp/global.css.bak-before-home-append   → FIRST_493_LINES_BYTE_IDENTICAL
```

追加块前 493 行 → 1264 行。追加块自身 sha256: `b3d0d9a1cf8099f35d56b96c8ddb379916b4e1f3d5139c42cf76b4429e1acfe9`

禁止改动的文件,sha256 与追加前基线完全一致 (见 `evidence/baseline-sha256.txt`):

| 文件 | 基线 sha256 | 完成时 sha256 | 结论 |
|---|---|---|---|
| `src/pages/index.astro` | `2f05502d…3773ec` | `2f05502d…3773ec` | 未改 |
| `src/components/SiteHeader.astro` | `8bd4b562…365022` | `8bd4b562…365022` | 未改 |
| `src/layouts/BaseLayout.astro` | `29a5f4e5…f0d0d8` | `29a5f4e5…f0d0d8` | 未改 |
| `src/pages/en/index.astro` | `7c806e6f…0608c5c` | `7c806e6f…0608c5c` | 未改 |
| 三个 SVG 真源 | 见上表 | 见上表 | 未改 |

本任务只改了 `src/styles/global.css` 一个文件。

## 2. CSS 覆盖与取色(SVG 真源)

32 个必需类全部覆盖,且出现在构建产物 `dist/_astro/BaseLayout.CFGrA3-V.css` 中。
取色全部来自三个 SVG 里的实际 `fill` / `stroke` 值:

| 项 | 值 | SVG 出处 |
|---|---|---|
| 页面底 | `#FBFCF8` | 三个 SVG 的首个 `<rect fill="#FBFCF8">` |
| A 卡 | `#E6F4F0` | `01-…desktop.svg` L49 |
| B 卡 | `#FFF3D2` | L60 |
| C 卡 | `#E5E9FF` | L70 |
| D 卡 | `#FFF7DE` | L81 |
| 描边 | `#D7EAE5` | L49/60/70/81 `stroke` |
| 圆角 | `20px` | L49/60/70/81 `rx="20"` |
| 蟹按钮 | `#123C46` | L94 `fill="#123C46"` (bubble) |
| 蟹底框 | `#FFF6DE` / `#F0E4C2` | L90 |
| E 徽章 | `#FFF3D2` 底 / `#F7B83E` 边字 | `03-…svg` L37-38 |
| F 徽章 | `#E5E9FF` 底 / `#6C73D9` 边字 | L46-47 |
| E 状态丸 | `#FFF3D2` / `#EEDCA9` | L41 |
| F 状态丸 | `#E5E9FF` / `#CDD4F5` | L50 |
| 五席并列点 | `#149C9B` `#6C73D9` `#78A9C8` `#EF7569` `#9DCFC1` | `01-…desktop.svg` L118-134 |

桌面卡高 96px 落在要求的 **92–104px** 区间内;间距列 16px / 行 14px,落在 **12–16px** 区间内。

## 3. 每条命令的原始退出码

| # | 命令 | 退出码 | 日志 |
|---|---|---|---|
| 1 | `cd ~/2609/askclaw.dev-astro && NODE_OPTIONS=--max-old-space-size=2560 npm run build` | **0** | `evidence/build-home.log` |
| 2 | `scp -r dist/* 26430:/var/www/askclaw-site/astro-preview/` | **0** | `evidence/deploy-home.log` |
| 2b | 远端核对 `ssh 26430 sha256sum …` | **0** | `evidence/final-home-run.log` |
| 3 | Playwright 真浏览器 (`node /tmp/home-check.mjs`) | **0** | `evidence/home-browser-summary.txt`, `evidence/home-browser-report.json` |

构建输出: `4 page(s) built`,页面 `/`、`/en/`、`/method/`、`/rank/`。

远端 `index.html` sha256 = 本地 `dist/index.html` sha256 = `7286dc28a80df8df387042db7c11c6a0faf549d53cf42a1e0dda7199bad52807`
远端 CSS `BaseLayout.CFGrA3-V.css` sha256 = 本地 `dist/_astro/BaseLayout.CFGrA3-V.css` sha256 = `d1e538112584d49cba703f64839b6605b2574a584349c11855b0cf66a4646b74`

部署范围: 只写了 `astro-preview/` 内部。父目录 `/var/www/askclaw-site/` 的
`README.md / SECURITY.md / amber/ / assets/ / axes.html / axes.json / en.html / index.html / robots.txt / sitemap.xml`
时间戳全部保持 09-18T01:12 ~ 09-19T05:56,未被触碰。

## 4. 真浏览器读数 (https://askclaw.dev/astro-preview/)

截图绝对路径:
- `/home/computebox/2609/askclaw.dev-astro/evidence/home-1440.png` (1440×1000)
- `/home/computebox/2609/askclaw.dev-astro/evidence/home-390.png` (390×900)
- 附加: `evidence/home-pending-1440.png`、`evidence/home-pending-390.png`、`evidence/home-full-{1440,390}.png`

页面 URL 由 Playwright `page.url()` 记录为 `https://askclaw.dev/astro-preview/`,HTTP **200**。

### 1440 四卡 boundingBox + background-color

| 卡 | 文案 | x | y | w | h | background-color |
|---|---|---|---|---|---|---|
| A | 同一个模型,官方端点和第三方有差吗? | 140 | 216.28 | 390.58 | **96** | `rgb(230, 244, 240)` = #E6F4F0 |
| B | 新出的模型能不能打? | 546.58 | 216.28 | 390.59 | **96** | `rgb(255, 243, 210)` = #FFF3D2 |
| C | 我干这个活该用谁? | 140 | 326.28 | 390.58 | **96** | `rgb(229, 233, 255)` = #E5E9FF |
| D | 这榜自己可信吗? | 546.58 | 326.28 | 390.59 | **96** | `rgb(255, 247, 222)` = #FFF7DE |

- 2×2 确认: 两列 x ∈ {140, 546.58},两行 y ∈ {216.28, 326.28}
- 卡高 96px ∈ [92,104] ✔
- 列间距 16px,行间距 14px ∈ [12,16] ✔
- 圆角 `20px` ✔ · 描边 `rgb(215, 234, 229)` = #D7EAE5 ✔

### 1440 其它

- 页面底 `html/body/.home-page` 全部 `rgb(251, 252, 248)` = **#FBFCF8** ✔
- 蟹 bubble 背景 `rgb(18, 60, 70)` = **#123C46**,文字白色,`先问一句,我把路递给你。` ✔
- 蟹底框 `#FFF6DE` / 边框 `#F0E4C2` / 圆角 28px ✔
- `scrollWidth 1440 == clientWidth 1440` ✔ 无横向溢出

### 390 卡底边 y / banner 顶边 y

| 卡 | x | y | w | h | background-color |
|---|---|---|---|---|---|
| A | 20 | 241.30 | 167 | 128.90 | #E6F4F0 |
| B | 203 | 241.30 | 167 | 128.90 | #FFF3D2 |
| C | 20 | 384.20 | 167 | 118.00 | #E5E9FF |
| D | 203 | 384.20 | 167 | 118.00 | #FFF7DE |

- 移动端仍 **2×2**(两列 x ∈ {20, 203},两行 y ∈ {241.3, 384.2}) ✔
- 下排卡片底边 y = **502.16**
- 蟹 banner 顶边 y = **520.16**
- 间隙 = **18px** ≥ 7px,且 **不重叠**(502.16 < 520.16) ✔
- `scrollWidth 390 == clientWidth 390 == bodyScrollWidth 390` ✔ 无横向溢出
  (追加前基线为 **溢出**,见第 5 节)

### 传输字节数

| 项 | 1440 | 390 |
|---|---|---|
| 首页文档 transferSize | 3117 | 3117 |
| 首页总传输字节数 | **26322** | **26322** |
| 其中 CSS | 4307 | 4307 |
| 其中图片 (crab webp) | 18898 | 18898 |
| **其中 JS 字节数** | **0** | **0** |

- JS = 0 ✔ · `<script>` 标签数 = 0 ✔ · script 请求数 = 0 ✔
- 资源清单只有 2 条: CSS + crab-hero.webp。无网络字体(0 font 请求)。
- console errors / page errors / failed requests 均为空数组 ✔

### E/F 文案与颜色

| 行 | letter | 标题 | 说明 | 状态丸 | 徽章底/边 | 丸底/边 |
|---|---|---|---|---|---|---|
| E | E | AI 模型降智了吗? | 跨家复测还未齐,暂不声称能力回退。 | 数据待发布 | `rgb(255,243,210)`/`rgb(247,184,62)` | `rgb(255,243,210)`/`rgb(238,220,169)` |
| F | F | 在我关注的方面,有更好的平替吗? | 便宜候选需要成体系的价格 / 成本源。 | 价格待发布 | `rgb(229,233,255)`/`rgb(108,115,217)` | `rgb(229,233,255)`/`rgb(205,212,245)` |

与 `03-pending-section.svg` 文案逐字一致,颜色与 SVG 取值一致。尾注 `次级区只记缺口,不替数据提前下结论。` ✔

## 5. 回归证明 — 非首页零影响

`global.css` 是共享样式,`/method/`、`/rank/`、`/en/` 也用同一份。用同一份
Playwright 脚本分别对"追加前基线构建"和"追加后构建"截图,再比对 sha256:
**6 张截图全部字节完全相同**。

| 截图 | 结果 |
|---|---|
| `en-1440` | IDENTICAL `ed8c0a37…3bdf4f` |
| `en-390` | IDENTICAL `bca57dad…1a84d6` |
| `method-1440` | IDENTICAL `febb2bdd…fa85` |
| `method-390` | IDENTICAL `0155ab59…c3ac5` |
| `rank-1440` | IDENTICAL `d4b9ec92…82eed5` |
| `rank-390` | IDENTICAL `655fd798…044f09a2` |

四路由 (/, /method/, /rank/, /en/) 在本机静态服务下都是 200、无 console/page/request/HTTP 错误,
`scriptTags` 与基线一致 (`/rank/` = 1,其余 = 0)。见 `evidence/route-stats-after.json`。

追加前基线额外暴露的两个问题,追加后消失:
- `/` 在 390 宽度 **横向溢出** (基线 `overflow390: true` → 现在 `false`)
- `/` 页面底为 `rgb(250, 253, 254)` (基线) → 现在 `rgb(251, 252, 248)` = #FBFCF8

## 6. 已知的既有缺陷 (非本任务引入,未修)

仓库自带 `npm run acceptance` 在 **追加 CSS 之前就已经失败**,失败点与本改动无关:

```
locator.click: Timeout 30000ms exceeded.
waiting for locator('.header-nav a[href="/astro-preview/method/"]')
  at scripts/acceptance.mjs:263:74
```

`SiteHeader.astro` 的导航项路径是 `/method/#repos-title` 与 `/method/#verify-title`
(带 hash),不存在裸 `/method/`,所以 `scripts/acceptance.mjs:263` 的选择器永远匹配不到。
对照实验: 用追加前的 `global.css` 重建后跑同一套 acceptance,**同样失败于同一行同一选择器**
(`/tmp/build-baseline.log` + `/tmp/global-baseline` 运行记录)。本任务不允许改
`SiteHeader.astro` 或 `scripts/`,故未修,仅记录。

## 7. 备注

- 远端 `astro-preview/_astro/` 里留有早前构建的旧哈希产物
  (`BaseLayout.Bc8_lLlO.css`、`BaseLayout.Bf6P9waT.css`)。当前 `index.html` 只引用
  `BaseLayout.CFGrA3-V.css`,旧文件不被引用、不影响线上;它们位于 `astro-preview/` 内,
  本任务未做清理(清理属追加性副作用之外的写操作)。
- 未执行 `git push`。未提交 commit。改动仅留在工作区。
