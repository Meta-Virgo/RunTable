# Changelog

## 2026-06-07 - Room Experience Tools

### Added

- Added a new in-room `Room Tools` entry from the sidebar.
- Added a room report view with separate public and Keeper-only sections.
- Added a clue wall for Keepers to create, hide, reveal, tag, delete, and link clues to recent public room logs.
- Added invitation and scheduling foundations in the room tools view.
- Added character snapshot capture for end-of-session continuity.
- Added a Keeper toolbox for NPC/monster speaking identities and batch secret rolls.
- Added CoC automation commands through the existing chat command path:
  - `.growth <skill> <currentValue> <roll>`
  - `.bp bonus <tens...> <ones>`
  - `.penalty penalty <tens...> <ones>`
  - `.opp <name> <target> <roll> <name> <target> <roll>`
- Added membership-backed room authority helpers for join and restore flows.
- Added user-facing join failure and kicked-state feedback helpers.
- Added service-level behavior models for clue visibility, invitations, Keeper toolbox actions, session snapshots, voice feedback, room members, and room authority.
- Added agent docs and the room experience PRD under `docs/`.

### Changed

- Removed the duplicate sidebar room member panel from the room UI. Participant/voice indicators remain on the existing role and character lists.
- Updated story report generation so public reports exclude private messages and secret dice.
- Extended room session state to expose room role, membership status, room member items, and membership-aware kick behavior.
- Extended the existing tabletop command parser and command handler instead of adding a separate dice system.
- Ignored local Codex preview artifacts with `.codex-run/`.

### Verification

- `npm test` passed: 18 files, 51 tests.
- `npm run typecheck` passed.
- `npm run build` passed.

### Known Limitations

- Room tools data is currently persisted in browser `localStorage` per room. It is useful for local continuity, but it is not yet synced through Supabase or realtime channels.
- Invitation and scheduling are functional in the room UI, but do not yet send external notifications, calendar events, or mobile push reminders.
- Character snapshots are captured in the room tools UI, but are not yet written to a permanent database table.
