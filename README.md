# askclaw.dev

AskClaw 官网源码（Astro）。首页 = AMBER（琥珀式封存的历史回放评测）主站；`/amber/` 重定向回首页。

The askclaw.dev site source (Astro). The homepage IS the AMBER site (sealed-replay evaluation); `/amber/` redirects to `/`.

## 结构

- `src/` — Astro 页面与布局（首页、`/method/`、`/rank/`、`/en/`）
- `public/assets/` — 图（WebP，1400px 宽）
- 运行时边界：内容页零 JS，`/rank/` 有 3.5KB 内联交互脚本。
- Runtime boundary: content pages ship zero JS; `/rank/` has a 3.5KB inline interaction script.

老站（纯静态 `index.html` / `en.html` / `assets/`）不再放在本仓，真源在相邻 checkout（用 `LEGACY_SITE_ROOT` 指定）；图的原图在 [getaskclaw/amber](https://github.com/getaskclaw/amber) 的 `docs/images/`。

## 构建与两种 base

`site` 固定为 `https://askclaw.dev`；`base` 由 `SITE_BASE` 环境变量决定，默认 `/`（生产根）。两种 base 都要跑机检：

```bash
# 预览底（部署目标见运维手册（内部文档））：不索引，不生成 sitemap
# In the exact `&&` form below, each command is a new process, so the gate scripts also infer the
# already-built base from dist/index.html when SITE_BASE is not exported to the second command.
SITE_BASE=/astro-preview/ npm run build && npm run acceptance
SITE_BASE=/astro-preview/ npm run build && python3 scripts/verify-dist.py

# 生产底（默认，合并后真站产物）：
npm run build && npm run acceptance
npm run build && python3 scripts/verify-dist.py
```

- 机检脚本从 `SITE_BASE` / `astro.config.mjs` 推导 base 与期望 URL，不写死 `/astro-preview/`。
- `base != /` 时：每页输出 `<meta name="robots" content="noindex,nofollow">`，`robots.txt` 为 `Disallow: /`，且不生成 sitemap。
- `base == /` 时：不输出 robots meta，`robots.txt` 含 `Sitemap:`，sitemap 列出生产 URL。

## 机检依赖

两个脚本都要读老站 checkout（对比 `/en/` 镜像与图的原图），它是独立目录、不在本仓内：

| 变量 | 默认值 | 用途 |
|---|---|---|
| `LEGACY_SITE_ROOT` | `../askclaw.dev`（相对本仓） | 老站根；缺 `en.html` / `assets/*.png` 时脚本开头给可读报错 |
| `AXES_SOURCE` | 本仓 `src/data/axes.json` | 轴数据真源 |
| `SITE_BASE` | `/` | 构建 base，同时决定机检期望的 URL 前缀 |

在标准机器上无需设置（老站仓为相邻 checkout）。换机器或路径不同时显式指定：

```bash
LEGACY_SITE_ROOT=/path/to/legacy-site npm run acceptance
LEGACY_SITE_ROOT=/path/to/legacy-site python3 scripts/verify-dist.py
```

## 部署（DEPLOY）

托管与 Caddy 配置：预览部署目标见运维手册（内部文档）。改配置前必备份，改后执行配置校验并 reload。

预览只动 `astro-preview/` 子目录，线上根路径与老站不动：

```bash
cd <astro-site-checkout>
SITE_BASE=/astro-preview/ npm run build
rsync -a --delete dist/ <preview-deployment-target>/
```

## 联系 / Contact

- GitHub: github@askclaw.dev
- Security: security@askclaw.dev
