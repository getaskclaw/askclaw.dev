# Knowledge Base Source Analysis

Last updated: 2026-04-28

This note tracks GitHub repos, X posts, and tools that may help design AskClaw / English Coach shared knowledge memory.

## Evaluation lens

We compare each source against the English Coach shared-KB goal:

```text
many agents
one learner
shared progress
searchable memory
review scheduling
auditable updates
small browser UI
```

Key questions:

1. Does it compound knowledge over time, or only retrieve chunks at query time?
2. Does it support multiple agents safely writing to the same knowledge base?
3. Does it separate raw sources, synthesized knowledge, and per-user progress?
4. Does it expose search/query APIs suitable for a Chrome extension?
5. Does it track provenance, versioning, and update history?
6. Can it support spaced repetition or learner-state updates?

---

## 1. Karpathy — LLM Knowledge Bases / LLM Wiki

Source:

- X post: <https://x.com/karpathy/status/2039805659525644595>
- Gist: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>

### Core idea

Karpathy's pattern is not classic RAG.

Classic RAG:

```text
raw docs -> chunk/retrieve at query time -> answer
```

LLM Wiki:

```text
raw sources -> LLM compiles persistent markdown wiki -> future queries read compiled knowledge
```

The important shift is **compiled, persistent, maintained knowledge**. The agent does not rediscover the same facts on every query. It updates entity pages, concept pages, comparisons, indexes, logs, and contradiction notes as new sources arrive.

### Architecture

Karpathy's three layers:

```text
raw sources   = immutable source truth
wiki          = LLM-owned markdown synthesis
schema        = rules/instructions for maintaining the wiki
```

Operations:

- **Ingest** — add source to raw collection, summarize, update relevant wiki pages, update index/log.
- **Query** — read index + relevant pages, synthesize answer, optionally file the answer back into the wiki.
- **Lint** — find contradictions, stale claims, orphan pages, missing links, missing pages, and data gaps.

Suggested UI/tools:

- Obsidian as frontend/IDE.
- Obsidian Web Clipper for article-to-markdown capture.
- Local images under `raw/assets/`.
- Git for version history.
- Optional local search such as `qmd` for hybrid BM25/vector search.

### Strengths for AskClaw / English Coach

- Strong mental model: **knowledge should compile and accumulate**, not disappear into chat history.
- Markdown makes the KB inspectable by humans and agents.
- `index.md` and `log.md` give agents a cheap orientation layer.
- Linting maps well to agent maintenance tasks.
- Great for concept knowledge: grammar explanations, learner mistake taxonomies, article/book notes, source-derived vocabulary, phrase examples.

### Gaps for English Coach

Karpathy's pattern is source/wiki-first, not learner-state-first.

It does not directly solve:

- per-learner review scheduling
- term exposure counts
- mistake counts
- due dates
- multi-agent write conflicts
- transactional event append
- Chrome extension API/search UX
- permissions and privacy per learner

For English Coach, use LLM Wiki as the **compiled knowledge layer**, not as the only storage layer.

Recommended adaptation:

```text
DB event log      = source of truth for learner progress
Markdown wiki     = compiled, human-readable knowledge synthesis
Search index/API  = query layer for agents + Chrome extension
```

---

## 2. NousResearch/hermes-agent — bundled `llm-wiki` skill

Source:

- Repo: <https://github.com/NousResearch/hermes-agent>
- Local clone inspected: `/home/computebox/work/kb-source-analysis/hermes-agent`
- Commit inspected: `e0e67a99`
- Key file: `skills/research/llm-wiki/SKILL.md`

### What it implements

Hermes implements Karpathy's idea as a **skill**, not as a standalone KB backend.

The skill file is a 506-line procedural spec that tells Hermes agents how to:

- initialize a wiki
- orient before touching an existing wiki
- ingest raw sources
- update entity/concept/comparison/query pages
- maintain `SCHEMA.md`, `index.md`, and `log.md`
- run lint/health checks
- integrate with Obsidian and `obsidian-headless`

Default wiki path:

```bash
WIKI="${WIKI_PATH:-$HOME/wiki}"
```

Recommended wiki shape:

```text
wiki/
├── SCHEMA.md
├── index.md
├── log.md
├── raw/
│   ├── articles/
│   ├── papers/
│   ├── transcripts/
│   └── assets/
├── entities/
├── concepts/
├── comparisons/
└── queries/
```

### Important implementation details found in code

Hermes skills become slash commands through `agent/skill_commands.py`:

- `scan_skill_commands()` scans installed `SKILL.md` files.
- Skill names are normalized into slash commands.
- `llm-wiki` becomes `/llm-wiki`.
- Telegram-style underscore commands also resolve: `/llm_wiki` resolves to `/llm-wiki`.

Verified locally with a temporary Hermes home:

```text
copied_count 81
has_llm_wiki True
/llm-wiki registered True
llm_wiki resolves to /llm-wiki
```

Targeted tests run:

```text
python3 -m pytest tests/agent/test_skill_commands.py tests/tools/test_skills_sync.py -q
80 passed in 1.51s
```

### Skill update machinery relevant to multi-agent installs

Hermes has two update paths.

#### Bundled skills

Implemented in `tools/skills_sync.py`.

Bundled skills are copied from the Hermes repo into `~/.hermes/skills/` and tracked by:

```text
~/.hermes/skills/.bundled_manifest
```

The manifest stores skill name + origin hash.

Update behavior:

- New bundled skill → copied.
- User copy unchanged and bundled version changed → updated.
- User modified local copy → skipped to avoid overwriting user changes.
- User deleted skill → respected.
- Removed upstream bundled skill → manifest cleaned.

This is useful for agent fleets because it gives a hash-based freshness check for bundled skills, but it depends on Hermes update/sync reaching every profile/host.

#### Hub-installed skills

Implemented in `tools/skills_hub.py`.

Hub-installed skills are tracked in:

```text
~/.hermes/skills/.hub/lock.json
```

The lock records:

```text
source
identifier
trust_level
scan_verdict
content_hash
install_path
files
metadata
installed_at
updated_at
```

`hermes skills check` compares installed `content_hash` against the latest fetched bundle hash.

`hermes skills update` reinstalls skills where `status == update_available`.

This is closer to what `BlueBirdBack/english-coach` needs if the skill is distributed as a GitHub/hub skill.

### Strengths for AskClaw / English Coach

- Already encodes the right orientation discipline: read schema, index, recent log before acting.
- Explicit raw/source immutability.
- Built-in update/index/log/lint conventions.
- Strong provenance concepts: raw frontmatter, hashes, sources, confidence, contested claims.
- Obsidian-compatible by default.
- Works with normal Hermes skill loading and slash commands.

### Limitations

Hermes `llm-wiki` is a **behavior spec**, not a data system.

It does not provide:

- DB schema
- API server
- browser extension
- locking/concurrency control
- vector/BM25 search implementation
- per-user permissions
- per-learner SRS state
- event-sourced progress history

Multiple agents can all follow the skill, but if they write the same markdown repo concurrently, `index.md` and `log.md` can race. Git helps with history, but not with transactional concurrent writes.

### Fit for English Coach

Use it, but only for one layer.

Good use:

```text
English Coach Wiki
├── raw/                    # articles, transcripts, user-approved examples
├── concepts/               # grammar concepts, pronunciation issues, idioms
├── entities/               # maybe books/courses/sources, not users
├── comparisons/            # phrase/collocation comparisons
├── queries/                # useful saved explanations
├── index.md
├── log.md
└── SCHEMA.md
```

Not enough for:

```text
term seen_count
mistake_count
next_due
review history
browser-page encounters
multi-agent writes
```

Those belong in a shared DB/API.

---

## 3. MemPalace/mempalace — local-first AI memory palace

Source:

- Repo: <https://github.com/MemPalace/mempalace>
- Local clone inspected: `/home/computebox/work/kb-source-analysis/mempalace`
- Branch inspected: `develop`
- Commit inspected: `fdfaf01`
- Package version: `3.3.3`

### What it implements

MemPalace is closer to a real memory substrate than the LLM Wiki sources. It ships a Python package, CLI, ChromaDB-backed local store, and MCP server for agents.

Core model:

```text
wing    = person / project / top-level domain
room    = topic within a wing
closet  = compact index / pointer layer
drawer  = verbatim stored text chunk
tunnel  = cross-wing room connection
KG      = temporal entity relationship graph in SQLite
```

The default backend is ChromaDB, behind a pluggable backend interface. Core operations are local-first and do not require an API key. Optional LLM paths exist for richer closet generation or reranking, but the advertised core retrieval path is API-free.

### Important implementation details found in code

- `mempalace/backends/base.py` defines a backend abstraction; `mempalace/backends/chroma.py` implements the current ChromaDB backend.
- `mempalace/miner.py` mines project files into verbatim drawers with metadata. It respects `.gitignore`, skips generated/cache directories, chunks files, and serializes writes to the same palace with file locks.
- `mempalace/convo_miner.py` mines conversation exports into exchange-pair chunks.
- `mempalace/normalize.py` supports Claude.ai JSON, ChatGPT export, Claude Code JSONL, OpenAI Codex CLI JSONL, Gemini CLI JSONL, Slack JSON, and plain text.
- `mempalace/searcher.py` uses hybrid retrieval: vector search plus BM25 reranking, closet boosting, neighbor expansion, and a SQLite BM25 fallback when HNSW/vector state is unsafe.
- `mempalace/knowledge_graph.py` provides a local SQLite temporal KG with add/query/invalidate/timeline semantics.
- `mempalace/mcp_server.py` exposes 29 MCP tools for read/write, KG, graph navigation, drawer management, agent diaries, hooks, and reconnect.
- Write operations are recorded through a redacted write-ahead log in `~/.mempalace/wal/write_log.jsonl`.
- The docs describe a 4-layer memory stack: L0 identity, L1 essential story, L2 filtered recall, L3 deep search.

### Verification run

Local setup and tests were run in the clone with an isolated `.venv`.

```text
pip install -e ".[dev]"
python -m pytest -q
1461 passed, 1 skipped, 106 deselected, 1 warning in 28.26s

ruff check .
All checks passed!

ruff format --check .   # with CI-pinned ruff 0.4.10
115 files already formatted
```

One environment note: with the default `ulimit -n` of `1024`, the first full test run hit ChromaDB/SQLite open-file exhaustion. Re-running with `ulimit -n 8192` passed. That is operationally relevant for large local-memory workloads or CI containers.

Codebase footprint, excluding venv/cache/build dirs:

```text
Tracked files: 280
First-party package + tests: 113 Python files, ~24k Python code lines
Full repo includes large benchmark/result JSON files and website/docs assets
```

### Strengths for AskClaw / English Coach

- Strong local-first privacy posture: useful for personal transcripts, agent diaries, and sensitive user context.
- Verbatim storage is a good antidote to summary drift; agents can cite original drawer text.
- MCP interface is immediately agent-friendly.
- Hybrid vector + BM25 search is more practical than pure vector search for logs, code, and language-learning snippets.
- Temporal KG is relevant for facts that change over time.
- Agent diary tools map well to AskClaw specialist agents such as reviewer, ops, architect, or coach.
- The wake-up stack is a useful pattern: small always-loaded context plus on-demand recall.
- Ingestion adapters for Claude/Codex/Gemini/ChatGPT/Slack are directly relevant to compiling multi-agent work history.

### Gaps for English Coach

MemPalace is a memory/retrieval system, not a learner-progress product.

It does not directly provide:

- spaced-repetition scheduling
- review cards with `next_due`, ease, lapses, and interval state
- per-learner term exposure counters
- mistake/correction lifecycle
- browser-extension API
- account/auth/permissions for multiple learners
- distributed locking across VPSes or many agent hosts
- transactional event append API for multi-agent writes

Agent diaries are separated by agent name, which is good for specialist continuity but not enough for shared learner state. For English Coach, the learner's progress must belong to the learner, not to each agent's diary wing.

### Fit for English Coach / AskClaw

MemPalace is a strong candidate for the **local semantic memory and agent-history layer**, not the canonical learner-progress database.

Good adaptation:

```text
English Coach DB/API
  = learner events, review state, permissions, idempotency

MemPalace-like memory index
  = verbatim transcripts, agent diaries, semantic recall, source-backed context

LLM Wiki
  = compiled explanations, grammar concepts, reusable notes

Chrome extension
  = search/save/review UI over the DB/API, optionally querying the memory index
```

For AskClaw, MemPalace is more reusable as an **operator memory vault**: mine agent sessions, PR reviews, incidents, user decisions, and research sources, then expose them to agents through MCP search.

For English Coach, copy the ideas, not the whole data model.

---

## Comparison against English Coach shared-KB design

| Dimension | Karpathy LLM Wiki | Hermes `llm-wiki` skill | MemPalace | English Coach shared KB need |
|---|---|---|---|---|
| Primary unit | Markdown wiki page | Markdown wiki page + agent procedure | Verbatim drawer + wing/room metadata + KG triple | Learner event + review card + compiled note |
| Source of truth | Raw files + wiki | Raw files + wiki | Local ChromaDB/SQLite palace | DB event log for progress; raw/wiki/index for knowledge |
| Human UI | Obsidian | Obsidian / editor | CLI/docs; agent-facing MCP | Chrome extension + chat + optional Obsidian |
| Agent orientation | `index.md`, `log.md`, schema | Explicit required orientation steps | `mempalace_status`, wake-up stack, taxonomy/search tools | API should return compact learner context + wiki/search results |
| Search | Index file; optional qmd | `search_files`; optional external tools | Hybrid vector + BM25 + metadata filters | Full-text + vector + filters + due-review query |
| Updates | Agent edits markdown | Agent edits markdown by skill rules | Agents/CLI add drawers, KG facts, diary entries | Agents append events transactionally; compiler updates wiki/index |
| Multi-agent safety | Not addressed | Not addressed beyond conventions | Local locks and WAL; not distributed | Needs API, locking, idempotency, audit log |
| Skill freshness | N/A | Manifest / hub lock hashes | N/A for skills; package/plugin version can be tracked | Fleet-wide `english-coach` version tracking |
| SRS | N/A | N/A | N/A | Required: SM-2/FSRS-style scheduler |
| Privacy | Depends on local files | Depends on local files | Strong local-first default | Per-learner access control and deletion/export |

## Recommendation

Adopt the LLM Wiki pattern as the **compiled knowledge layer**, not the whole product architecture.

Recommended stack:

```text
1. Event DB
   - learner encounters
   - corrections
   - review events
   - agent runs

2. Compiled Markdown Wiki
   - grammar concepts
   - learner-safe summaries
   - source notes
   - reusable explanations
   - lintable knowledge graph

3. Search/API layer
   - exact search
   - semantic search
   - due reviews
   - learner context summary

4. Chrome extension
   - save selected text
   - search memory
   - ask English Coach
   - show seen-before / due-review state
```

The key design move:

```text
Do not make every agent remember.
Make every agent write to the same event log,
then compile useful knowledge into a wiki.
```

## Reusable ideas to copy

From Karpathy/Hermes:

- `raw/` is immutable.
- `SCHEMA.md` defines agent behavior and taxonomy.
- `index.md` is required agent orientation.
- `log.md` is append-only operational memory.
- queries worth keeping get filed back into the KB.
- health checks/linting are first-class operations.
- Obsidian compatibility is a cheap high-quality human UI.

From MemPalace:

- verbatim drawers instead of lossy summaries
- wing/room metadata filters for scoped recall
- hybrid vector + BM25 search
- MCP-first agent interface
- temporal KG with explicit invalidation
- agent diaries as specialist continuity streams
- wake-up stack: identity + essential story + on-demand recall + deep search
- local-first privacy posture and optional LLM enrichment

For English Coach, add:

- central learner DB
- event append API
- review scheduler
- Chrome extension side panel
- lock/idempotency rules for multi-agent writes
- skill version recorded on every event
- distributed sync/permissions if multiple agents or VPSes write the same learner state
