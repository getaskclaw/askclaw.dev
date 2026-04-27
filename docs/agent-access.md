# Agent access model

AskClaw uses named machine-user accounts for routine agent work. Agents do not use owner/admin credentials for normal code changes.

## 身份 / Identity

- GitHub organization: `getaskclaw`
- Agent account: `askclaw-ash`
- Display name: `Ash 🌿`
- Team: `agents`

## 权限 / Permissions

Current baseline:

- `getaskclaw/.github`: read-only access for agents
- `getaskclaw/askclaw.dev`: write access for agents
- `main`: protected branch; changes go through pull requests

Write access means agents may create branches and open PRs. It does not mean direct-to-`main` changes.

## Token policy

Use fine-grained personal access tokens for machine users:

- Resource owner: `getaskclaw`
- Repository access: selected repositories only
- Default repository: `askclaw.dev`
- Minimum permissions for routine work:
  - Contents: read/write
  - Pull requests: read/write
  - Issues: read/write
  - Metadata: read-only
- Expiration: short-lived, normally 90 days or less

Never store tokens, passwords, recovery codes, or TOTP secrets in this repository, GitHub issues, pull requests, chat logs, or screenshots.

## Operating rules

- Keep owner/admin tokens for organization setup only.
- Use `askclaw-ash` for routine branches, commits, issues, and PRs.
- Store recovery codes and PATs in a password manager such as KeePass.
- Rotate machine-user tokens before expiry.
- Revoke tokens immediately if copied into chat, logs, commits, or any public place.

## Verification checklist

Before granting or using agent write access:

- 2FA is enabled for the machine-user account.
- Recovery codes are stored outside chat and outside the repository.
- The machine user is in the `agents` team.
- The target repository has branch protection enabled.
- A smoke test confirms branch create/delete works with the machine-user token.
