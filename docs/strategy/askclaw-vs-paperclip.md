# AskClaw vs Paperclip

This note captures the strategic split between AskClaw and [Paperclip](https://github.com/paperclipai/paperclip).

## Short version

Paperclip is open-source infrastructure for orchestrating **zero-human companies**.

AskClaw should be the operating layer for **one-person companies**: one human founder, many agents, across the whole business.

Cleaner:

> Paperclip runs agent orgs. AskClaw helps a solo founder run a company with agents.

Sharper:

> Paperclip organizes agents into companies. AskClaw turns one founder into a company.

## Core difference

| Area | Paperclip | AskClaw |
|---|---|---|
| Core framing | Zero-human companies | One-person companies |
| User role | Board/governor of autonomous agents | Founder/operator reviewing decisions |
| Main abstraction | Agents, org charts, tasks, budgets, governance | Business outcomes, workflows, decisions, company execution |
| Product feel | Agent ops dashboard / control plane | Founder-facing OPC command center |
| Starting point | “Hire agents and assign goals” | “What should my company do next?” |
| Scope | Strong on agent orchestration mechanics | Product, ops, support, growth, finance, docs, deployment |
| Risk | Can become infra-heavy | Can become fluffy unless tied to real execution |
| Best metaphor | Kubernetes/Jira for agent companies | Shopify/Notion/COO for a one-person company |

## Strategic difference

Paperclip says:

> If OpenClaw is an employee, Paperclip is the company.

AskClaw should not answer with:

> No, we are also the company.

That becomes mud wrestling.

AskClaw should say:

> You are the company. AskClaw gives every meaningful task an agent.

This keeps the human founder central. That is the wedge.

## Where Paperclip is strong

Paperclip already claims the agent-infrastructure lane:

- Bring-your-own agents: OpenClaw, Claude Code, Codex, Cursor, Bash, HTTP
- Org charts
- Budgets
- Governance
- Heartbeats
- Tickets
- Multi-company isolation
- Company templates / Clipmart direction
- Self-hosted open-source quickstart

If AskClaw’s pitch is only “OPC control plane for agents,” Paperclip can punch it in the face. Politely. With a README.

## Where AskClaw can win

AskClaw should own the founder experience, not just the agent infrastructure.

### 1. Decision layer

AskClaw should answer:

> Here are the three decisions that matter today.

Not just:

> Here are all your agent tasks.

### 2. Business playbooks

The product should ship opinionated playbooks for real solo-founder workflows:

- Launch a product
- Validate a market
- Write docs
- Handle users
- Ship updates
- Run a growth loop
- Triage support
- Operate infrastructure
- Track cash, spend, and risk

### 3. Taste and judgment

AskClaw should not only dispatch agents. It should help decide what is worth doing.

The founder should receive good next moves, not a bigger task queue.

### 4. Cross-domain execution

GitHub is only one surface. AskClaw should span:

- Code
- Content
- Support
- Analytics
- Finance
- Ops
- CRM
- Social
- Deployment
- Documentation

### 5. One-human philosophy

Paperclip is “zero-human company.”

AskClaw should be “human amplified to company-scale.”

## Positioning guidance

Avoid public copy that sounds like Paperclip:

- “AI agents run your company”
- “Org chart for agents”
- “Autonomous AI company control plane”
- “Agent task board with budgets and governance”

Prefer founder-centered copy:

- “Turn one founder into a company.”
- “Every meaningful task gets an agent.”
- “Review decisions, not busywork.”
- “Your company keeps moving even when you lose momentum.”
- “Agents initiate, execute, escalate, and close real work.”

## Best positioning line

Broad audience:

> AskClaw turns solo founders into one-person companies with AI agents.

Technical/developer audience:

> AskClaw is the OPC control layer for solo founders: every meaningful task gets an agent, and you review decisions instead of busywork.

Founder-first wedge:

> You are the company. AskClaw gives every meaningful task an agent.

## Product implication

AskClaw should not start by copying an agent org chart.

It should start from founder outcomes:

1. What matters today?
2. What can agents do without me?
3. What decisions need my judgment?
4. What work is blocked?
5. What changed while I was away?
6. What should be shipped, answered, fixed, posted, or escalated next?

The command center should make the founder feel less like a manager of bots and more like a company with leverage.
