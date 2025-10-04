# Snippet App — Worktree Status

**Version:** MVP V1
**Status:** ✅ SHIPPING
**Platform:** macOS (primary)

---

## ✅ DONE (V1 Features)

### Core Infrastructure
- [x] Tauri + React + TypeScript setup
- [x] SQLite local database (via `tauri-plugin-sql`)
- [x] Clipboard read/write (Rust `arboard` crate)
- [x] Tailwind CSS styling (@tailwindcss/postcss)

### CRUD Operations
- [x] Create snippet (keyword + name + text)
- [x] Edit snippet
- [x] Delete snippet (with confirmation)
- [x] Enable/Disable toggle per snippet
- [x] Search by keyword or name

### Snippet Execution
- [x] Parse and execute snippets
- [x] Support `{clipboard}` placeholder
- [x] Support `{cursor}` placeholder (position tracking)
- [x] Support `{argument name="..." options="..." default="..."}` placeholder
- [x] Dynamic form generation for arguments
- [x] Dropdown selects for arguments with options
- [x] Text inputs for free-form arguments
- [x] Copy result to clipboard

### Import/Export
- [x] Import Raycast JSON format (paste → preview → confirm)
- [x] Export to Raycast JSON format (download file)
- [x] Validation on import (structure + required fields)
- [x] Preview imported snippets before saving

### UI/UX
- [x] Snippet list with search
- [x] Snippet cards with actions (Run/Edit/Enable/Delete)
- [x] Modal forms for Create/Edit
- [x] Modal for snippet execution
- [x] Modal for import with preview
- [x] Active/Inactive visual states
- [x] Responsive layout (Tailwind)

---

## 🚫 CUT from V1 (Ship Later)

These were in the original PDR but removed to ship fast:

- ❌ Supabase integration (auth, sync, realtime)
- ❌ Teams & collaboration
- ❌ Multi-user with RLS policies
- ❌ Cross-platform builds (Windows/Linux)
- ❌ Global hotkey to open app
- ❌ Auto-expand on typing in other apps
- ❌ Multiple `{cursor}` positions
- ❌ Snippet folders/tags/categories
- ❌ Snippet templates library
- ❌ Analytics/usage tracking

---

## 🎯 V2 Roadmap (Ship ONLY if V1 gets traction)

### After 10 Daily Users

**Priority 1: Cloud Sync (Supabase)**
- [ ] User authentication (email OTP or OAuth)
- [ ] Sync snippets to Supabase Postgres
- [ ] Conflict resolution (last-write-wins for MVP)
- [ ] Offline-first with sync on reconnect

**Priority 2: Teams (Basic)**
- [ ] Create team
- [ ] Invite members (email)
- [ ] Share snippets at team level
- [ ] Realtime updates when team snippets change

### After 50 Paying Users ($9/month)

**Priority 3: Advanced Execution**
- [ ] Global hotkey (Cmd+Shift+Space) to open
- [ ] Quick launcher (fuzzy search snippets)
- [ ] Auto-paste after execution (optional)
- [ ] History of executed snippets

**Priority 4: Multi-Platform**
- [ ] Windows build (`npm run tauri build` for Windows)
- [ ] Linux build (AppImage/deb)
- [ ] Platform-specific installers

**Priority 5: UX Polish**
- [ ] Snippet folders/categories
- [ ] Keyboard shortcuts (j/k navigation, Enter to run)
- [ ] Dark mode support
- [ ] Snippet duplication
- [ ] Bulk actions (delete multiple, export selection)

### After 100 Paying Users

**Priority 6: Advanced Placeholders**
- [ ] `{date format="YYYY-MM-DD"}`
- [ ] `{time format="HH:mm"}`
- [ ] `{uuid}`
- [ ] `{random min="1" max="100"}`
- [ ] Custom JavaScript expressions

**Priority 7: Templates & Marketplace**
- [ ] Pre-built snippet collections
- [ ] Community snippet sharing
- [ ] Import from URL

---

## 🐛 Known Issues / Tech Debt

### Bugs
- None reported yet (V1 just shipped)

### Tech Debt
- Node.js version warning (Vite requires 20.19+, running 20.18.3) - non-blocking
- No error boundaries in React
- No loading states on async operations
- No offline detection
- No keyboard shortcuts

### Missing Tests
- [ ] Unit tests for parser.ts (extractArguments, substituteArguments)
- [ ] Unit tests for executor.ts (executeSnippet)
- [ ] E2E tests (create → execute → export flow)
- [ ] Clipboard mocking for tests

---

## 📊 Success Metrics (Track These)

**V1 Goals (First 30 Days):**
- [ ] 10 daily active users
- [ ] 100+ snippets created total
- [ ] 500+ snippet executions
- [ ] 5 users who imported from Raycast

**V2 Trigger (If Hit):**
- 50 users willing to pay $9/month
- 1000+ snippet executions/day
- Feature requests mentioning "teams" or "sync"

**Kill Switch (If Miss):**
- <5 daily users after 30 days → quit & next project
- Zero conversions after adding payment → pivot or quit

---

## 🚀 Immediate Next Actions

**Before Public Launch:**
1. [ ] Test on fresh Mac (no dev environment)
2. [ ] Build production binary (`npm run tauri build`)
3. [ ] Test binary installation
4. [ ] Create 3 demo snippets (email, code template, meeting notes)
5. [ ] Screenshot the app
6. [ ] Record 30-sec demo video

**Launch Day:**
1. [ ] GitHub repo public
2. [ ] Post to r/macapps
3. [ ] Tweet with #buildinpublic
4. [ ] Post to Hacker News "Show HN"
5. [ ] Add to Product Hunt

**Week 1:**
1. [ ] Monitor user feedback
2. [ ] Fix critical bugs within 24h
3. [ ] Add Plausible/Simple Analytics (privacy-friendly)
4. [ ] Collect feature requests (GitHub Issues)

---

## 💡 Feature Requests Template

When users ask for features, triage using this:

**Ship in V1 Patch (Same Week):**
- Critical bugs
- Data loss prevention
- Import/export fixes

**Consider for V2 (After Validation):**
- Sync/cloud features
- Teams/collaboration
- Multi-platform

**Say No To (Politely):**
- Over-engineering (CRDT, custom sync, etc.)
- Features <3 users request
- Anything that delays next ship

---

## 📝 Notes

- **Philosophy:** Ship → Learn → Iterate
- **Decision Framework:** Would this help 10+ users pay $9/month?
- **Tech Stack:** Keep simple. No fancy state management until pain point.
- **Design:** Copy Raycast. Don't reinvent.

**Last Updated:** 2025-10-04
**Next Review:** After 10 daily users OR 30 days (whichever comes first)
