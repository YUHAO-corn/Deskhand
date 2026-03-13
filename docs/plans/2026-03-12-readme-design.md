# README Design — All Sections

> Brainstormed 2026-03-12. Updated 2026-03-13 with Sections 4 & 5.

---

## Section 1: Tagline

Style: functional description (Option C).

> An AI desktop agent that reads local context and invokes tools
> to help non-technical users — and everyone else — get things done.

- One to two sentences, English
- Emphasize: local context + tool use + non-technical friendly

---

## Section 2: Resource Links

Two links with placeholder URLs for now:

| Resource | Description | URL |
|----------|-------------|-----|
| Showcase | Single-page scrolling site covering product thinking and technical deep-dives (11 sections) | `[TBD]` |
| QA Column | Astro blog with 10 topic series documenting the solo-builder decision journey | `[TBD]` |

---

## Section 3: Value Showcase (Screenshots)

Layout: vertical, one image per row, each with a one-line caption.

5 images, in this order:

| # | Scenario | Why it matters | Image |
|---|----------|---------------|-------|
| 1 | Disk scan → cleanup suggestions with permission prompt | Desktop-exclusive — web AI can't do this | `[placeholder]` |
| 2 | WeChat public account download data → Excel analysis in Artifact | Practical office workflow, data pipeline | `[placeholder]` |
| 3 | Analysis results → HTML visualization dashboard | Continuous task chaining + visual impact | `[placeholder]` |
| 4 | Apple Notes classification + sensitive info (passwords) isolation | Smart organization with privacy awareness | `[placeholder]` |
| 5 | Weekly report → Word rendering in Artifact | Office worker daily need | `[placeholder]` |

Notes:
- Scenario 4: use mock data or redact real passwords in screenshot
- Scenarios 2→3 form a narrative chain (same data, escalating output)
- Uniform screenshot dimensions preferred

---

## Section 6: Quick Start

Prerequisites: Git, Bun (no separate Node.js needed).

```bash
git clone https://github.com/xxx/Deskhand.git
cd Deskhand
bun install
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY
# Get one at https://console.anthropic.com/
bun run electron:dev
```

Optional `.env` fields (mention briefly, don't expand):
- `ANTHROPIC_BASE_URL` — for third-party proxies
- `ANTHROPIC_MODEL` — override default model

---

## Section 7: Tail (Standards)

- **License**: MIT — create `LICENSE` file at repo root
- **Contributing**: short paragraph — how to file issues / submit PRs
- **Acknowledgments**: Anthropic SDK, Claude Agent SDK

---

## Section 4: Feature Highlights

### Spotlight Features (1 image + 1-2 sentence each)

**Generative UI (A2UI)**
- Image: `genui-playground` (blog style explorer with controls + live preview)
- Copy: AI generates interactive UI components — Playground for style exploration, Tournament for preference discovery, Guided Form for step-by-step input collection.

**Skill Insight**
- Image: `skill-insight` (analysis report + install button)
- Copy: Analyzes your usage patterns, identifies friction points, and recommends skills to install — one click to activate.

**Clipboard Intelligence**
- Image: `clipboard-2` (work trajectory analysis)
- Copy: Background clipboard monitoring gives the AI awareness of your working context — ask it to summarize your week and it already knows.

### Other Features (feature list, no images)

- **Permission System** — Ask mode requires confirmation; Allow-All mode for trusted workflows
- **Session Management** — Persistent conversations with lazy loading, rename, archive, delete
- **Artifact Panel** — Preview HTML, Excel, Word, and code in a side panel
- **Activity Tree** — Visual step-by-step display of tool execution progress

---

## Section 5: Architecture & Tech Stack

### Tech Stack (layered table)

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 33, Node.js |
| UI | React 18, TailwindCSS 4, Radix UI |
| State | Jotai |
| AI | Claude Agent SDK, Anthropic SDK, MCP SDK |
| Build | Vite 6, esbuild, TypeScript 5 |
| Storage | JSONL (append-only) |

### Architecture Diagram

Hand-drawn excalidraw style (placeholder until drawn).

Three-layer structure top to bottom:

1. **Renderer (React)** — SessionSidebar, ChatArea, ArtifactPanel, InputToolbar, A2UI, Popups + Jotai Atoms
2. **IPC Bridge** (Preload) — single communication channel
3. **Main Process (Node.js)** — Deskhand Agent (Permission, Tool Execution, A2UI Tools, Thinking Level) + Session Storage + Skill System + Clipboard Monitor + Insight Pipeline
4. **External** — Claude API (cloud) + Local Filesystem & OS APIs
