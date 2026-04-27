# EmDash site plan

AskClaw should evaluate EmDash as the first implementation path for `askclaw.dev`.

Source references:

- Cloudflare announcement: https://blog.cloudflare.com/emdash-wordpress/
- EmDash repo: https://github.com/emdash-cms/emdash
- Marketing template: https://github.com/emdash-cms/templates/tree/main/marketing-cloudflare

## Why it fits

EmDash matches the AskClaw direction better than WordPress:

- TypeScript-first, Astro-based site stack
- Cloudflare-native deployment with Workers, D1, and R2
- CMS/admin workflow without a PHP hosting tier
- Sandboxed plugins through Dynamic Workers instead of WordPress-style full-trust plugins
- Agent-friendly CLI and content model for scripted updates

## Initial decision

Start from the **EmDash Marketing Template for Cloudflare**, not the blog template.

Reason: `askclaw.dev` first needs a clear product landing site. Blog/docs can be added after the landing page is live.

Planned route shape:

```text
/          landing page
/pricing   pricing / offer page
/contact   contact and support entry
/blog      optional later
/docs      optional later
```

## Phase 1 scope

Build the smallest useful public site:

- Hero: one-person company, end-to-end AI agents
- Sections: problem, workflow, agent capabilities, trust/security
- CTA: contact or early access
- Contact form routed to `support@askclaw.dev`
- Security contact points to `security@askclaw.dev`
- Basic SEO metadata and Open Graph image
- Bilingual positioning where it helps, but keep the page short

## Technical baseline

Target stack:

```text
Framework: Astro via EmDash
Runtime: Cloudflare Workers
Database: Cloudflare D1
Storage: Cloudflare R2
Package manager: pnpm
Template: marketing-cloudflare
```

Dynamic Workers are required for secure sandboxed plugins on Cloudflare paid Workers plans. For the first landing page, plugins can stay disabled unless needed.

## Agent workflow

- `askclaw-ash` creates feature branches and PRs only.
- Owner/admin credentials are reserved for Cloudflare account setup, DNS, and protected-branch merges.
- No tokens, recovery codes, or Cloudflare secrets are committed.
- Deployment secrets should live in Cloudflare and/or GitHub Actions secrets, not in Markdown.

## Open questions

- Which Cloudflare account owns `askclaw.dev` deployment?
- Should the first version deploy through Cloudflare Pages or Workers-only EmDash flow?
- Do we want Chinese-first bilingual copy on the landing page, or English-first for developer reach?
- Should `askclaw.dev` become the product site while `askclaw.top` remains untouched as the existing KB app?

## Next build steps

1. Generate an EmDash marketing-cloudflare starter in a separate branch.
2. Strip demo content and add AskClaw brand copy.
3. Run local dev and build checks.
4. Add Cloudflare deployment docs without committing secrets.
5. Open a PR for review before any public deployment.
