# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Snippet Runner** is a local-first desktop app for managing and executing text snippets with dynamic placeholders. Built with Tauri + React + TypeScript, it's compatible with Raycast's snippet format.

**Current Status:** MVP V1 - Local-only, no cloud sync (see WORKTREE.md for roadmap)

## Development Commands

### Running the App
```bash
npm run tauri dev          # Start development server + open desktop app
npm run dev                # Start Vite dev server only (for web debugging)
```

### Building
```bash
npm run build              # Build web assets (TypeScript + Vite)
npm run tauri build        # Build production desktop binary
```

### Production Binary Location
After `npm run tauri build`:
- macOS: `src-tauri/target/release/bundle/macos/`
- Windows: `src-tauri/target/release/bundle/msi/`
- Linux: `src-tauri/target/release/bundle/appimage/`

## Architecture

### High-Level Data Flow

```
User Action (React UI)
    ↓
Database Operations (db.ts) ← SQLite via tauri-plugin-sql
    ↓
Snippet Execution (executor.ts)
    ↓
Parser (parser.ts) → Extracts placeholders
    ↓
Clipboard Commands (Rust IPC) → Tauri backend (clipboard.rs)
```

### Key Architectural Decisions

**1. Local-First Storage**
- SQLite database (`tauri-plugin-sql`) stores all snippets
- Database file: `snippets.db` (in Tauri's app data directory)
- No sync, no auth, no cloud in V1 (intentional MVP scope)

**2. Rust-TypeScript Bridge**
- **Clipboard operations** are Rust commands (via `arboard` crate)
- TypeScript calls Rust via `invoke()` from `@tauri-apps/api/core`
- See `src-tauri/src/clipboard.rs` for Tauri command definitions

**3. Snippet Execution Pipeline**
- `parser.ts`: Regex-based placeholder extraction
- `executor.ts`: Orchestrates substitution (arguments → clipboard → cursor)
- Execution is **synchronous** and **local** (no network calls)

**4. Raycast Compatibility**
- Import/Export use exact Raycast JSON schema: `{ keyword, name, text }[]`
- Placeholders supported: `{clipboard}`, `{cursor}`, `{argument name="..." options="..." default="..."}`
- Multiple `{cursor}` = uses first occurrence only

### Code Structure

```
src/
├── App.tsx           # Main UI component (all modals, CRUD, execution)
├── db.ts             # SQLite CRUD operations (getSnippets, createSnippet, etc.)
├── types.ts          # TypeScript interfaces (Snippet, RaycastSnippet)
├── parser.ts         # Placeholder extraction (extractArguments, etc.)
├── executor.ts       # Snippet execution + clipboard integration
└── main.tsx          # React entry point

src-tauri/src/
├── lib.rs            # Tauri app setup + plugin registration
└── clipboard.rs      # Rust clipboard commands (read_clipboard, write_clipboard)
```

**Important:** `App.tsx` is intentionally monolithic (480+ lines). This is MVP pragmatism—don't split into components until there's a performance or maintainability pain point.

## Placeholder System

**Supported Placeholders:**

1. **`{clipboard}`** - Injects current clipboard content
2. **`{cursor}`** - Marks cursor position (index returned, not physically placed)
3. **`{argument name="X" options="A,B" default="A"}`** - Dynamic form input
   - With `options`: renders dropdown
   - Without `options`: renders text input

**Execution Order:**
1. Substitute `{argument ...}` with user input
2. Substitute `{clipboard}` with system clipboard
3. Replace `{cursor}` with placeholder token → find index → remove token

**Regex Patterns** (in `parser.ts`):
```typescript
const ARG_REGEX = /\{argument\s+name="([^"]+)"(?:\s+options="([^"]+)")?(?:\s+default="([^"]+)")?\}/g;
const CLIPBOARD_REGEX = /\{clipboard\}/g;
const CURSOR_REGEX = /\{cursor\}/g;
```

## Database Schema

**Table: `snippets`**
```sql
CREATE TABLE snippets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,  -- SQLite stores booleans as 0/1
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Note:** `active` is stored as `INTEGER` but converted to `boolean` in TypeScript (see `db.ts` mapping).

## Tauri IPC Commands

**Available Rust Commands:**

```typescript
import { invoke } from "@tauri-apps/api/core";

// Read clipboard
const text = await invoke<string>("read_clipboard");

// Write to clipboard
await invoke("write_clipboard", { text: "Hello" });
```

**Rust Implementation:** See `src-tauri/src/clipboard.rs`

## Critical Constraints

### V1 Scope Limits (Do NOT Add Without User Validation)

**❌ Blocked Features:**
- Supabase/cloud sync
- User authentication
- Teams/collaboration
- Cross-platform builds (only macOS for now)
- Global hotkeys
- Auto-expand on typing

**Why?** Ship → Validate → Iterate. See WORKTREE.md section "🚫 CUT from V1".

### When to Add Features

**Triggers for V2 (from WORKTREE.md):**
- 10 daily users → Consider cloud sync
- 50 paying users → Multi-platform builds
- <5 users after 30 days → Kill project

## Known Issues

### Non-Blocking
- Node.js 20.18.3 vs Vite requirement 20.19+ (warning only, works fine)
- No React error boundaries
- No loading states on async DB operations
- No keyboard shortcuts

### Missing Tests
- Unit tests for `parser.ts` (extractArguments, substituteArguments, etc.)
- Unit tests for `executor.ts` (executeSnippet)
- E2E tests (create → execute → export flow)

**Rationale:** Ship first, test when users validate the product.

## Development Philosophy (from WORKTREE.md)

**Decision Framework:**
- Would this help 10+ users pay $9/month? → Consider it
- <3 users requesting a feature? → Say no
- Delays next ship? → Cut it

**Tech Stack Principles:**
- Keep it simple (no Zustand/Redux until state management becomes a pain)
- Copy Raycast's design (don't reinvent)
- Local-first (cloud sync is V2)

## Adding New Placeholders

If users request new placeholders (e.g., `{date}`, `{uuid}`), follow this pattern:

1. Add regex pattern in `parser.ts`
2. Add substitution function in `executor.ts`
3. Update execution pipeline in `executeSnippet()`
4. Document in README.md

**Example (hypothetical `{date}` placeholder):**
```typescript
// parser.ts
const DATE_REGEX = /\{date format="([^"]+)"\}/g;

// executor.ts
function substituteDate(text: string, format: string): string {
  const now = new Date();
  // Format date using `format` string
  return text.replace(DATE_REGEX, formattedDate);
}
```

## Rust Dependencies

**Why `arboard`?**
- Cross-platform clipboard library
- Simpler API than `clipboard-win` or `x11-clipboard`
- No async complexity

**Adding Rust Dependencies:**
```bash
cd src-tauri
cargo add <crate-name>
```

## Tailwind CSS Setup

**Important:** Using Tailwind v4 with `@tailwindcss/postcss` (not the old v3 setup).

**CSS Import:**
```css
/* src/App.css */
@import "tailwindcss";
```

**Config:** `tailwind.config.js` and `postcss.config.js` must use `@tailwindcss/postcss` plugin.

## Deployment Checklist (Before Launch)

See WORKTREE.md → "🚀 Immediate Next Actions" for full list.

**Quick Launch:**
1. `npm run tauri build`
2. Test binary on fresh Mac
3. Screenshot app + record demo
4. Push to GitHub
5. Post to r/macapps, Twitter, Hacker News

## When Users Report Bugs

**Triage Priority:**
- **Critical (fix within 24h):** Data loss, crashes, import/export broken
- **High (fix this week):** Snippet execution fails, clipboard issues
- **Low (V2):** UI polish, missing keyboard shortcuts, feature requests

**Bug Fix Workflow:**
1. Reproduce locally
2. Fix in feature branch
3. Test manually (no automated tests yet)
4. Ship via patch release (`0.1.1`, `0.1.2`, etc.)
