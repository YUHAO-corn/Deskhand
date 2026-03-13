# README Design — Sections 1, 2, 3, 6, 7

> Brainstormed 2026-03-12. Covers the "simple" sections only.
> Sections 4 (Feature Highlights) and 5 (Engineering) are deferred.

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
