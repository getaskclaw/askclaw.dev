# askclaw.dev

AskClaw 官网源码。首页 = AMBER（琥珀式封存的历史回放评测）主站；`/amber/` 重定向回首页。

The askclaw.dev site source. The homepage IS the AMBER site (sealed-replay evaluation); `/amber/` redirects to `/`.

## 结构

- `index.html` / `en.html` — 首页（中/英）
- `amber/` — 重定向页
- `assets/` — 图（PNG 兜底 + Vega-Lite spec + 自托管 vega/vega-embed）
- 运行时边界：内容页零 JS，`/rank/` 有 3.5KB 内联交互脚本。
- Runtime boundary: content pages ship zero JS; `/rank/` has a 3.5KB inline interaction script.

## 部署（DEPLOY）

托管：26430 的 Caddy，文档根 `/var/www/askclaw-site`，域名块在 `/etc/caddy/Caddyfile`（改前必备份，改后 `caddy validate && systemctl reload caddy`）。

同步流程（在 2651 上）：

```bash
cd ~/2609/askclaw-dev-site          # 编辑工作区
tar czf /tmp/site.tgz index.html en.html amber assets
scp /tmp/site.tgz 26430.tail744929.ts.net:/tmp/
ssh 26430.tail744929.ts.net 'sudo tar xzf /tmp/site.tgz -C /var/www/askclaw-site'
```

改完务必同步本仓（PR → review → merge）。图的真源在 [getaskclaw/amber](https://github.com/getaskclaw/amber) 的 `docs/images/`。

## 联系 / Contact

- GitHub: github@askclaw.dev
- Security: security@askclaw.dev
