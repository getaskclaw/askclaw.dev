# WO-AXES-ASTRO — 验收摘要

当前裁决（2026-09-21）：owner 原话「屁的代价 不留」。axes redirect 全部摘除，不保留 Astro 跳转、专用 build 设置或 Caddy 接管方案。下文第一轮所有 301 配置和部署建议均已作废；本轮实施与验收见文末补节。

## 第一轮历史记录（redirect 决策已被 owner 终裁取代）

日期：2026-09-21（UTC）
执行：codex 席；Kanban：`default / t_269f19c9`
仓：`/home/computebox/2609/askclaw.dev-astro`
分支：`feat/astro-batch2-onmain`
起始提交：`3d45c292f5e0a0d8aaf6de6d2ff6a229d70d9464`
实现提交：`0417e2c2c50694b3e19ebe6ed2d2ba9ad78f8315`

结论：五刀已落地，生产底 `/` 和预览底 `/astro-preview/` 的 build、dist gate、浏览器 acceptance 均退出 0。13 车道旧字段完整保留。未部署、未 SSH、未 rsync、未 push、未改 main 或 Caddy。

交付分界：源码、静态产物、配置层已验收；真正的线上 HTTP 301 尚未配置或验证，按工单第 6 项允许的静态站例外，交由 Vesper 在 Caddy 层落地。不能将本单表述为“线上 301 已生效”。

## 五刀逐条核销

1. `src/data/axes.json`：13 条记录全部新增 `axis.convergence`。
   - `{"p":1,"n":1}` 恰好 5 条：`k3`、`gpt-5.6-luna-900k (max 档)`、`deepseek-flash`、`doubao-seed-evolving`、`glm-5.3-flash`。
   - `{"p":0,"n":0}` 恰好 8 条：`swe-2-max`、`deepseek-v4.1-flash`、`hy4-preview-f`、`deepseek-flash (GA)`、`step-5-preview`、`gpt-5.6-sol-900k (high 档)`、`Qwen3.8-27B`、`qwen3.8-27b`。
   - `deepseek-flash` 是 OpenCode Go 车道 `ocgo`，没有把官方 GA 车道 `ds` 误标为有数据。
   - 去掉新增键后，与起始提交的完整 JSON 深度相等，包括记录顺序、车道名、total、n、cases、wk、vendor、repo、file 和原八轴分数。没有从仅 12 车道且总分已变化的遗留 public JSON 覆盖 canonical 数据。
2. `src/pages/rank/index.astro:15`：faces 尾部只增 `['convergence', '收敛']`。
3. `src/pages/en/rank/index.astro:15`：检查原有英文标签后，faces 尾部只增 `['convergence', 'Convergence']`。
   - 两页去掉各自新增的一行后，与起始提交逐字节一致；其他逻辑没有改。
4. 删除 `public/axes.html` 与 `public/axes.json`。最终 dist 中 `axes.html` 路径（文件或目录）与 `axes.json` 均不存在。
5. `astro.config.mjs:14-20`：新增显式 `/axes.html` → `/rank/`、`status: 301`；目标保留尾斜杠。为满足“dist/axes.html 不存在”，设 `build.redirects: false`，不生成静态 meta-refresh 替代页；HTTP 301 的 Caddy 接管见下方决策点。

必要的验收同步：仅另改 `scripts/verify-dist.py` 和 `scripts/acceptance.mjs`，移除旧页必须存在/轴数必须为 8 的旧断言，改为 9 轴、旧产物必须消失、精确 5 条 1/1 与 8 条无数据、双语标签和点击过滤检查，并校验 redirect 配置。没有删掉资产、SEO、语言、交互、排序或数据保真回归。

## 验收矩阵

| 工单验收项 | 实跑结果 | 证据 |
| --- | --- | --- |
| 1. `npm run build` | PASS，exit 0 | 下方生产构建原始输出；最终产物为生产 base `/` |
| 2. `python3 scripts/verify-dist.py` | PASS，exit 0 | 下方 JSON 摘录；旧产物不存在、收敛名单、sitemap、资产门均通过 |
| 3. `node scripts/acceptance.mjs` | PASS，exit 0，存在且适用 | 7 路由 HTTP 200；两张 rank 页 9 chips、原预设 13 车道、收敛筛选精确 5 车道 |
| 4. dist 与双语文案 | PASS | 不存在 `dist/axes.html`/`dist/axes.json`；两个 rank 产物含对应标签 |
| 5. 全部提交、工作区干净 | PASS（实现提交后实查） | 下方 `git status`；本摘要单独文档提交，最终 HEAD 与 clean 状态在外部交付副本补记 |
| 6. redirect 证据 | 配置层 PASS；静态站限制已如实记录 | 显式映射与 301 已加载验证；默认 meta-refresh 产物已亲自复现；Caddy 方案未执行 |

额外回归：`SITE_BASE=/astro-preview/ npm run build`、`python3 scripts/verify-dist.py`、`node scripts/acceptance.mjs` 同样全部 exit 0；gate 从构建产物识别预览 base，不需要把临时环境变量传给后续命令。`node --check scripts/acceptance.mjs`、`node --check astro.config.mjs`、`git diff --check` 均 exit 0。

## 生产 build 原始输出

命令：`npm run build`；exit 0。

```text
> askclaw.dev-astro@0.1.0 build
> astro build

05:35:51 [types] Generated 50ms
05:35:51 [build] output: "static"
05:35:51 [build] mode: "static"
05:35:51 [build] directory: /home/computebox/2609/askclaw.dev-astro/dist/
05:35:51 [build] Collecting build info...
05:35:51 [build] ✓ Completed in 97ms.
05:35:51 [build] Building static entrypoints...
05:35:51 [vite] ✓ built in 166ms
05:35:51 [vite] ✓ built in 25ms
05:35:51 [build] Rearranging server assets...

 generating static routes
05:35:51   ├─ /axes.html/index.html (+3ms) (file not created, response body was empty)
05:35:51   ├─ /claim/index.html (+9ms)
05:35:51   ├─ /en/claim/index.html (+11ms)
05:35:51   ├─ /en/rank/index.html (+4ms)
05:35:51   ├─ /en/index.html (+7ms)
05:35:51   ├─ /method/index.html (+3ms)
05:35:51   ├─ /notes/agent-is-new-software/index.html (+3ms)
05:35:51   ├─ /notes/index.html (+3ms)
05:35:51   ├─ /rank/index.html (+3ms)
05:35:51   ├─ /robots.txt (+5ms)
05:35:51   ├─ /index.html (+7ms)
05:35:51 ✓ Completed in 71ms.

05:35:51 [build] ✓ Completed in 296ms.
05:35:51 [@astrojs/sitemap] `sitemap-index.xml` created at `dist`
05:35:51 [build] 9 page(s) built in 412ms
05:35:51 [build] Complete!
```

日志中的 `/axes.html/index.html` 是遍历路由时的提示，不代表有文件。紧随的 `file not created` 与下方路径不存在断言相互印证。

## verify-dist 输出摘录

命令：`python3 scripts/verify-dist.py`；exit 0。以下为实际 JSON 字段投影，完整 stdout 路径见文末。

```json
{
  "convergence": {
    "lanes": 13,
    "scored": ["k3", "gpt-5.6-luna-900k (max 档)", "deepseek-flash", "doubao-seed-evolving", "glm-5.3-flash"],
    "no_data": ["swe-2-max", "deepseek-v4.1-flash", "hy4-preview-f", "deepseek-flash (GA)", "step-5-preview", "gpt-5.6-sol-900k (high 档)", "Qwen3.8-27B", "qwen3.8-27b"],
    "legacy_artifacts_absent": true
  },
  "data_sha256": "0d724d79a6ee08e9d4f84913b1eb16ffa371da332c63c75bd15ef9d7a4c5186e",
  "frameworks": [],
  "external_js_files": [],
  "network_fonts": [],
  "sitemap": {
    "routes": [
      "https://askclaw.dev/",
      "https://askclaw.dev/claim/",
      "https://askclaw.dev/en/",
      "https://askclaw.dev/en/claim/",
      "https://askclaw.dev/en/rank/",
      "https://askclaw.dev/method/",
      "https://askclaw.dev/notes/",
      "https://askclaw.dev/notes/agent-is-new-software/",
      "https://askclaw.dev/rank/"
    ],
    "hreflang_count": 12,
    "generated": true,
    "base": "/"
  }
}
```

预览底同一 gate 的实际 sitemap 输出：

```json
{"routes":[],"hreflang_count":0,"generated":false,"base":"/astro-preview/"}
```

## 浏览器 acceptance 输出摘录

命令：`node scripts/acceptance.mjs`；exit 0。以下为原始 JSONL 经 jq 统计及字段投影，不是模拟浏览器结果。

```json
{
  "routes": 7,
  "all_status_200": true,
  "all_error_arrays_empty": true,
  "rank_pages": [
    {
      "route": "/rank/",
      "chipCount": 9,
      "presetRowCount": 13,
      "laneDataPreserved": true,
      "rankOrderPreserved": true,
      "chipInteractionPassed": true,
      "convergenceChip": "收敛5/5 满分",
      "convergenceRows": ["k3", "gpt-5.6-luna-900k (max 档)", "deepseek-flash", "doubao-seed-evolving", "glm-5.3-flash"],
      "convergenceScores": ["1/1", "1/1", "1/1", "1/1", "1/1"],
      "convergencePassed": true
    },
    {
      "route": "/en/rank/",
      "chipCount": 9,
      "presetRowCount": 13,
      "laneDataPreserved": true,
      "rankOrderPreserved": true,
      "chipInteractionPassed": true,
      "convergenceChip": "Convergence5/5 full marks",
      "convergenceRows": ["k3", "gpt-5.6-luna-900k (max band)", "deepseek-flash", "doubao-seed-evolving", "glm-5.3-flash"],
      "convergenceScores": ["1/1", "1/1", "1/1", "1/1", "1/1"],
      "convergencePassed": true
    }
  ],
  "all_refresh_passed": true
}
```

路由全集：`/`、`/method/`、`/claim/`、`/rank/`、`/en/`、`/en/claim/`、`/en/rank/`。两种 base 各运行同一组 7 路由；无 console/page/request/HTTP 错误。收敛的 8 条无数据记录没有渲染成 `0/0` 零分行，而是沿用现有 `n > 0` 筛选行为。

## 保护项、dist、提交证据

独立脚本 `/home/computebox/.hermes/profiles/codex/cache/scratch/wo-axes-astro-verify.py --require-clean` 对照固定起始提交，退出 0。实际输出关键字段：

```json
{
  "verdict": "PASS",
  "baseline": "3d45c292f5e0a0d8aaf6de6d2ff6a229d70d9464",
  "branch": "feat/astro-batch2-onmain",
  "main_unchanged": "c1118a498bbdd3ff5b76eb8864571b607854c6d1",
  "lanes": 13,
  "convergence_scored_count": 5,
  "convergence_no_data_count": 8,
  "all_existing_lane_fields_and_order_preserved": true,
  "step_5_preview_preserved": true,
  "dependencies_unchanged": true,
  "legacy_source_and_dist_absent": true,
  "both_dist_labels_present": true,
  "head": "0417e2c2c50694b3e19ebe6ed2d2ba9ad78f8315",
  "git_status_clean": true
}
```

两张 rank 源文件分别删除新增 face 后逐字节相等。`package.json`、`package-lock.json` 与起始提交逐字节相等。`dist/rank/index.html` 为 20672 bytes，`dist/en/rank/index.html` 为 21112 bytes，均含各自收敛标签。

实现提交信息：

```text
0417e2c fix: migrate axes leaderboard to Astro rank with convergence
8 files changed, 101 insertions(+), 862 deletions(-)
```

提交正文逐项写明五刀。实现提交后亲跑 `git status`：

```text
On branch feat/astro-batch2-onmain
nothing to commit, working tree clean
```

本仓根 SUMMARY 另作纯文档提交；交付副本 `/tmp/wo-axes-astro-summary.md` 补记最终 HEAD 与提交后重跑结果，避免在已提交文档中自引用尚不存在的 commit hash。

## 决策点：静态输出与真正的 301

已做实际试验：只加 redirects、不关 HTML 输出时，Astro 构建成功，但生成 `dist/axes.html/index.html`（294 bytes）。读取到的产物为：

```html
<!doctype html><title>Redirecting to: /rank/</title><meta http-equiv="refresh" content="0;url=/rank/"><meta name="robots" content="noindex"><link rel="canonical" href="https://askclaw.dev/rank/"><body>	<a href="/rank/">Redirecting from <code>/axes.html/</code> to <code>/rank/</code></a></body>
```

此时新增的“旧路径必须不存在”gate 正确失败：

```text
File "/home/computebox/2609/askclaw.dev-astro/scripts/verify-dist.py", line 117, in <module>
    assert not (dist / retired).exists(), retired
AssertionError: axes.html
```

因此没有把 meta-refresh 冒充 HTTP 301，也没有把 `不存在` 偷换成 `不是普通文件`。最终配置由 Node 实际 import 后核验：

```json
{
  "output": "static",
  "base": "/",
  "trailingSlash": "always",
  "redirects": {"/axes.html":{"destination":"/rank/","status":301}},
  "build": {"redirects":false},
  "adapter": null,
  "proof": "Configuration verified; static HTML redirect emission disabled. Live HTTP 301 requires Caddy deployment by Vesper."
}
```

原 Caddy 替代方案及其部署验收要求已由 owner 终裁撤销，不再提供可执行配置。不给 axes 旧 URL 留兼容跳转，也不交由 Vesper 补跳转。本单没有读取或修改线上 Caddy。

依据：亲读安装版 `node_modules/astro/dist/core/build/generate.js:324-337` 与配置类型 `node_modules/astro/dist/types/public/config.d.ts:1404-1429`，并用真实浏览器核对官方 Astro 配置文档 redirects/build.redirects 与 Caddy redir 文档。官方说明与本机产物一致：无 adapter 的静态 HTML 跳转不提供 HTTP 状态码；关闭 build.redirects 则不输出该 HTML。

范围保留：按“禁动 rank 其他逻辑”，没有扩写原“全选 / Select all”预设；它的旧八轴串保持原样，收敛可由新增 chip 单独选中或组合。原 metadata 文案也未顺手修改。若需让“全选”纳入收敛或更新旧数字文案，应另开明确范围，不在本单暗改。

环境记录：尝试设置 `NODE_OPTIONS=--max-old-space-size=2560` 被单次无人值守安全策略拦下，未改审批设置；改用工单要求的原样 `npm run build` 后全部构建成功。未安装依赖，未改 Hermes 配置。在线 extraction 后端不支持抽取，已改用真实浏览器读取官方文档。

## 完整原始输出位置

所有诊断与 probe 均放本 profile 的 scratch；本节摘录与结论已提交入仓，原始 scratch 会按环境策略清理。

共同目录：`/home/computebox/.hermes/profiles/codex/cache/scratch/`

- `wo-axes-astro-build-redirect-default.log`：默认 redirect 的原始构建输出。
- `wo-axes-astro-redirect-default-gate.log`：默认 redirect 与不存在门冲突的真实失败。
- `wo-axes-astro-build-preview.log`：预览构建 stdout/stderr。
- `wo-axes-astro-verify-preview.json`、`wo-axes-astro-verify-preview.stderr`。
- `wo-axes-astro-acceptance-preview.jsonl`、`wo-axes-astro-acceptance-preview.stderr`。
- `wo-axes-astro-build-production.log`：生产构建 stdout/stderr。
- `wo-axes-astro-verify-production.json`、`wo-axes-astro-verify-production.stderr`。
- `wo-axes-astro-acceptance-production.jsonl`、`wo-axes-astro-acceptance-production.stderr`。
- `wo-axes-astro-protected-data-committed.json`：基准数据、禁止修改项与 clean 检查。
- `wo-axes-astro-redirect-config.json`：实际加载的配置层证据。

最终交付文件：仓根 `SUMMARY.md` 与 `/tmp/wo-axes-astro-summary.md`。完成标记仅在最终提交、验收、交付文件均成功后写入 `/home/computebox/.hermes/pending/wo-axes-astro.json.done`。

## Owner 终裁执行：redirect 全摘（2026-09-21）

Owner 原话：「屁的代价 不留」。本节取代第一轮所有 redirect/301/Caddy 接管决策。

- 删除 `astro.config.mjs` 的整个 `redirects` 块、专用 `build: { redirects: false }` 和相关 Caddy 注释；配置已与最初 `3d45c29` 版本逐字节一致。
- 删除 `scripts/acceptance.mjs` 的 redirect 映射断言与配套 static/build.redirects 断言，其他浏览器检查保留。
- 逐项检查 `scripts/verify-dist.py`：不存在 redirect 配置、状态码或目标断言，因此无需删代码。该文件与上一交付 `015b862` 逐字节一致，继续检查旧 axes 文件不存在、13 车道、收敛分布、标签、资产和 SEO。
- 本轮 `src/data/axes.json`、两张 rank 页、依赖清单均未改；不部署、不 push、不改 main 或线上 Caddy，不增加兼容入口。

实跑三件套，两种 base 均 exit 0：

```text
SITE_BASE=/astro-preview/ npm run build
06:28:13 [build] 9 page(s) built in 404ms
06:28:13 [build] Complete!
preview verify-dist exit=0
preview acceptance exit=0

npm run build
06:28:57 [build] 9 page(s) built in 447ms
06:28:57 [build] Complete!
production verify-dist exit=0
production acceptance exit=0
```

两份构建日志都没有 axes.html 路由。最终 dist 保留生产 base `/`；`dist/axes.html`、`dist/axes.json` 不存在，中文 rank 含「收敛」，英文 rank 含「Convergence」。浏览器 JSONL 的实际统计，两种 base 相同：

```json
{
  "routes": 7,
  "all_status_200": true,
  "all_error_arrays_empty": true,
  "rank_pages": [
    {"route":"/rank/","chipCount":9,"presetRowCount":13,"laneDataPreserved":true,"rankOrderPreserved":true,"convergencePassed":true},
    {"route":"/en/rank/","chipCount":9,"presetRowCount":13,"laneDataPreserved":true,"rankOrderPreserved":true,"convergencePassed":true}
  ]
}
```

数据 gate 仍报告 13 车道、指定 5 条有数据、其余 8 条无数据和 `legacy_artifacts_absent: true`；数据 SHA-256 仍为 `0d724d79a6ee08e9d4f84913b1eb16ffa371da332c63c75bd15ef9d7a4c5186e`。源代码/脚本搜索的 redirect 专用配置与断言结果为 0；`node --check`（配置和 acceptance）、`git diff --check` 均通过。

本轮一个独立提交包含配置删除、断言删除和本摘要更新，message 明示 owner 令摘 redirect。最终 commit 与提交后 clean 复核补入 `/tmp/wo-axes-astro-summary.md`，成功后创建 `.done2`。

原始 stdout/stderr 在 `/home/computebox/.hermes/profiles/codex/cache/scratch/`，文件名前缀 `wo-axes-astro-no-redirect-`，分别为 `build-preview.log`、`verify-preview.json`/`.stderr`、`acceptance-preview.jsonl`/`.stderr` 与对应 `production` 版本。
