# Second Brain

Vault: `C:\Users\alkes\Documents\ALL DA STUFF\`
Full schema: `C:\Users\alkes\Documents\ALL DA STUFF\CLAUDE.md`
Index: `C:\Users\alkes\Documents\ALL DA STUFF\wiki\index.md`
Log: `C:\Users\alkes\Documents\ALL DA STUFF\wiki\log.md`

---

## Session Start

1. Read vault `wiki\index.md` — orient on what's already logged.
2. If no project page exists for this project, create `wiki\pages\projects\{project-slug}.md` (see format below).

---

## Save Triggers

Log immediately when any of these occur — don't wait for session end:

| Trigger | Action |
|---|---|
| New tool / API / service used | Create or update `wiki\pages\tools\{slug}.md` |
| New automation / workflow built | Create `wiki\pages\automations\{slug}.md` |
| Prompt that works | Create `wiki\pages\prompts\{slug}.md` |
| Useful site / resource / repo found | Create `wiki\pages\inspirations\{slug}.md` |
| Project milestone, decision, or lesson | Update `wiki\pages\projects\{slug}.md` |

After any save: append one entry to `wiki\log.md`, update `wiki\index.md`.

---

## Formats

### Tool — `wiki\pages\tools\{slug}.md`
```
---
title: "{Name}"
type: tool
tags: [{category}]
created: {date}
updated: {date}
url: {url}
---
## What It Does
## When To Use It
## Tips & Tricks
## Used In Projects
[[{this-project}]]
```

### Automation — `wiki\pages\automations\{slug}.md`
```
---
title: "{Name}"
type: automation
tags: []
created: {date}
status: working
---
## What It Does
## Tools Used
## The Pattern
## Gotchas
## Used In Projects
[[{this-project}]]
```

### Prompt — `wiki\pages\prompts\{slug}.md`
```
---
title: "{Name}"
type: prompt
tags: [{task-type}]
created: {date}
model: {model}
status: working
---
## Purpose
## The Prompt
## Why It Works
## Performance Notes
## Used In Projects
[[{this-project}]]
```

### Inspiration — `wiki\pages\inspirations\{slug}.md`
```
---
title: "{Name}"
type: inspiration
tags: []
created: {date}
url: {url}
---
## What It Is
## What I Get From It
```

### Project — `wiki\pages\projects\{slug}.md`
```
---
title: "{Project Name}"
type: project
tags: []
created: {date}
updated: {date}
status: active
---
## What It Is
## Stack
## Automations Built
## Prompts Used
## Key Decisions
## What I Learned
```

---

## Log Entry Format

Append to `wiki\log.md`:
```
## [{YYYY-MM-DD}] {tool|automation|prompt|inspo|project} | {Title}
{1-2 lines: what was saved and why it matters}
```

## Index Entry Format

Add to the correct section in `wiki\index.md`:
```
- [[{slug}]] — {one-line description}
```

---

## Rules

- Never modify files in `raw\`.
- Never skip updating index + log after a save.
- If a tool/automation/prompt already has a page, update it — don't duplicate.
- Cross-link: tool pages list the projects they appear in; project pages list all tools used.
- File everything — no knowledge stays in chat history.
