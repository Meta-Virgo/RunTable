# Architecture Optimization Plan

Date: 2026-06-10

## Current Judgment

The architecture is now good enough for this pass. The main domain flows have deepened modules around 广场信息流, 大厅目录, 跑团指令, 个人大厅摘要, 调查员库, 好友 / 个人资料, 角色生命周期, 房间工具, 房间会话 Chat Surface, and 房间会话动作.

The remaining large files are mostly orchestration modules or dense view implementations whose current interfaces are earning their keep. By the deletion test, deleting the new modules would spread behavior back across callers; deleting the remaining shells would mostly move coordination elsewhere. Future work should deepen a module only when a product change reveals repeated knowledge or a second adapter at an existing seam.

## Completed Deepening

| Status | Area | Modules | Result |
| --- | --- | --- | --- |
| Done | 广场信息流 | `hooks/useSquareExperience.ts`, `hooks/useSquareFeed.ts`, `hooks/useSquareComments.ts`, `hooks/useSquareNotifications.ts`, `hooks/useSquareProfilePanel.ts` | Channel loading, post actions, comments, notifications, profile panel, and deletion confirmation are gathered behind one experience module. |
| Done | 大厅目录 | `hooks/useLobbyCatalog.ts`, `services/lobbyCatalogModel.ts` | Callers no longer build character-room ids manually; room filtering and room-change application live in the catalog model. |
| Done | 跑团指令 | `services/tabletopCommandExecutor.ts`, `hooks/useTabletopCommands.ts` | Command execution moved out of hook placement into a service module; the old hook path remains as a compatibility re-export. |
| Done | 个人大厅摘要 | `services/profileHistoryModel.ts`, `services/homeProfileModel.ts`, `services/squareProfileModel.ts` | Player/KP history assembly is shared, so profile history behavior has one test surface. |
| Done | 房间工具 | `services/roomToolsModel.ts`, `hooks/useRoomToolsState.ts` | Tool persistence parsing, tag normalization, and local time conversion are concentrated outside the UI. |
| Done | 房间会话动作 | `hooks/roomSessionRemoteAdapters.ts`, `hooks/useRoomSessionState.ts` | Remote adapters are created at one seam instead of being wired directly across the session hook. |
| Done | 房间会话 Chat Surface | `components/ChatArea.tsx`, `components/chat/*` | Message log rendering, composer behavior, AI assistant, and profile display now sit behind focused view modules. |
| Done | 房间辅助弹窗 | `components/modals/*`, `components/AppLazyComponents.ts` | Room information, character editing, status, story report, and conclusion modals now live in independent lazy-loaded modules instead of a broad modal drawer. |
| Done | 好友 / 个人资料 Social Surface | `components/Friends.tsx`, `services/friendsModel.ts`, `services/friendsRepository.ts`, `services/friendsProfileModel.ts`, `services/friendsProfileRepository.ts` | Friend profile history reuses the shared 个人大厅摘要 history model and view; friend search/request/delete behavior now sits behind a tested social model and repository. |
| Done | 角色生命周期 Import Model | `services/characterImportModel.ts`, `components/modals/CharacterModal.tsx` | `.st` import aliases and skill/stat parsing now have one tested model instead of living inside the character modal JSX. |

## Completed Candidates

### 1. 广场信息流 View Modules

Recommendation: Strong

Files: `components/Square.tsx`, new `components/square/*` modules

Problem: `Square.tsx` still contains the channel sidebar, composer, post list, notification menu, profile modal, post detail modal, confirmation dialog, and time/markdown helpers in one file. The domain workflow is now behind `useSquareExperience`, but the view implementation is still shallow: deleting a local JSX block would move its complexity back into the main file instead of revealing a deeper interface.

Solution: Extract cohesive presentational modules with narrow props. Start with the post detail modal and deletion confirmation, then continue with the post list, composer, notification menu, and profile modal.

Benefit: Better locality for visual bugs, smaller interfaces for future AI/code review navigation, and safer tests because `Square.tsx` can be tested as orchestration while submodules can be tested as rendering surfaces.

Status: Done for this pass.

Progress:

- 2026-06-09: Extracted post detail and deletion confirmation into `components/square/SquarePostDetailModal.tsx` and `components/square/SquareConfirmDialog.tsx`; moved shared time formatting to `components/square/squareTime.ts`. `components/Square.tsx` dropped from about 1384 lines to about 963 lines.
- 2026-06-09: Extracted channel sidebar, composer, notification menu, post list, and profile modal into `components/square/*`. `components/Square.tsx` is now about 289 lines and acts primarily as the 广场信息流 orchestration module.

### 2. 首页 / 大厅 Shell

Recommendation: Strong

Files: `components/Home.tsx`, candidate `components/home/*` modules

Problem: `Home.tsx` still mixes 大厅目录 controls, room creation/editing, 调查员库, friends/profile tabs, account security, history modal, and header scroll behavior. Several deeper modules exist, but their leverage is diluted because the caller still coordinates many unrelated local states.

Solution: Extract a home shell interface for tab/navigation/header behavior, then move rooms, investigators, profile, and history views behind separate modules.

Benefit: More locality around 大厅目录 and 个人大厅摘要 bugs; easier to add a new lobby tab without touching room creation or profile editing state.

Status: Done for this pass.

Progress:

- 2026-06-09: Extracted top/mobile navigation into `components/home/HomeNavigation.tsx`, keeping tab selection and friend-request badge behavior behind one view module.
- 2026-06-09: Extracted the personal history modal into `components/home/HomeHistoryModal.tsx`; moved character-display selection into the shared `services/profileHistoryModel.ts` so 首页 / 大厅 Shell and 广场信息流 share the same history display rules. `components/Home.tsx` is now about 981 lines, down from about 1291.
- 2026-06-09: Extracted the 大厅目录 rendering surface into `components/home/HomeLobbyView.tsx`, including search, filters, create-room form, loading state, and room grid. `components/Home.tsx` is now about 858 lines.
- 2026-06-10: Re-audit found the remaining `components/Home.tsx` responsibilities are mostly shell coordination for tabs, profile/account state, 调查员库 actions, and modal ownership. No strong deletion-test candidate remains without a new product change.

### 3. 房间会话 Chat Surface

Recommendation: Strong

Files: `components/ChatArea.tsx`, candidate `components/chat/*` modules

Problem: `ChatArea.tsx` mixes message rendering, dice controls, private-recipient selection, image paste/drop, AI assistant modal, profile lookup, quote state, and infinite-scroll behavior. 跑团指令 is already separate, but the room chat surface remains a broad view implementation.

Solution: Extract message rendering, chat composer, dice controls, AI modal, and profile modal. Keep message sending and dice rolling as explicit props from 房间会话.

Benefit: Better locality for UI regressions and a clearer test surface for message rendering versus composer behavior.

Status: Done for this pass.

Progress:

- 2026-06-09: Extracted user profile and AI assistant modals into `components/chat/ChatUserProfileModal.tsx` and `components/chat/ChatAiAssistantModal.tsx`, narrowing `components/ChatArea.tsx` to chat surface orchestration for those flows. `components/ChatArea.tsx` is now about 1225 lines, down from about 1336.
- 2026-06-09: Extracted message log rendering into `components/chat/ChatLogViewport.tsx`. Infinite scroll, long-press actions, dice/system log rendering, quote actions, delete actions, and profile-entry affordances now have a focused rendering module.
- 2026-06-09: Extracted the composer into `components/chat/ChatComposer.tsx`, including draft text, image paste/drop, dice controls, attribute/skill checks, private recipients, story report entry, and AI assistant state. `components/ChatArea.tsx` is now about 198 lines and acts as the 房间会话 chat shell.

### 4. 房间辅助弹窗

Recommendation: Strong

Files: `components/Modals.tsx`, `components/modals/*`, `components/AppLazyComponents.ts`

Problem: `components/Modals.tsx` was acting as a general modal drawer: room information, 角色生命周期 editing, quick status adjustment, story report preview, and conclusion settlement lived in one module. This made small modal changes load and navigate unrelated implementation.

Solution: Move the independent room information, 角色生命周期 editing, status, story report, and conclusion modals into their own modules and point lazy imports directly at those modules.

Benefit: Better locality for modal UI changes and better bundle leverage. The production build now emits `ModuleModal`, `CharacterModal`, `StatusModal`, `StoryModal`, and `ConclusionModal` as independent chunks, and the broad `Modals` drawer has been deleted.

Status: Done for this pass.

Progress:

- 2026-06-09: Extracted `components/modals/StatusModal.tsx`, `components/modals/StoryModal.tsx`, and `components/modals/ConclusionModal.tsx`; updated `components/AppLazyComponents.ts` to lazy-load each directly. `components/Modals.tsx` is now about 997 lines.
- 2026-06-10: Extracted `.st` character import parsing into `services/characterImportModel.ts` with `services/characterImportModel.test.ts`. `components/Modals.tsx` is now about 907 lines, and the character modal only applies an import result instead of owning alias tables and parsing rules.
- 2026-06-10: Extracted `components/modals/ModuleModal.tsx` and `components/modals/CharacterModal.tsx`; updated `components/AppLazyComponents.ts` and `components/Home.tsx` to import them directly. `components/Modals.tsx` was deleted.

## Future Watchlist

### 1. 房间会话 State Module

Recommendation: Worth exploring

Files: `hooks/useRoomSessionState.ts`, `hooks/roomSessionActions.ts`, `hooks/roomSessionMembers.ts`, `hooks/roomSessionModel.ts`

Problem: The remote adapter seam is better now, but the session hook still appears to be the place where multiple session concerns meet. Some of that is appropriate orchestration; the risk is letting it become a shallow pass-through over many helpers.

Solution: Re-audit after the view modules shrink. Only deepen if deletion tests show repeated session lifecycle knowledge across callers.

Benefit: Avoids unnecessary abstraction while keeping 房间会话动作 concentrated.

Status: Good enough now; revisit only when 房间会话 gains another adapter or repeated lifecycle knowledge appears outside the session modules.

### 2. 好友 / 个人资料 Social Surface

Recommendation: Worth exploring

Files: `components/Friends.tsx`, existing profile/history services

Problem: `Friends.tsx` still appears to mix friend list loading, friend requests, user search, profile resume/history panels, delete confirmation, and personal history display. Some of this may be a valid social surface, but the file is still broad enough that profile/history bugs require navigating unrelated friend-request UI.

Solution: Reuse the profile history display modules where possible, then split friend list/search/request/delete/profile-history surfaces only where the deletion test shows real locality gains.

Benefit: Better locality around personal history, friend deletion, and search-request interactions without prematurely inventing a new social-domain seam.

Status: Done for this pass.

Progress:

- 2026-06-09: Added `services/friendsProfileModel.ts` and `services/friendsProfileRepository.ts` as a small adapter over the shared 个人大厅摘要 history model. `components/Friends.tsx` now loads profile history through one interface and reuses `components/home/HomeHistoryModal.tsx` for the standalone history modal.
- 2026-06-10: Added `services/friendsModel.ts`, `services/friendsRepository.ts`, and `services/friendsModel.test.ts`. Friend list normalization, incoming request normalization, profile search, request cooldowns, existing-friendship notices, and friend request creation now have a tested interface outside the UI. `components/Friends.tsx` is now about 712 lines, down from about 1045.

### 3. 音乐目录 Playback Surface

Recommendation: Speculative

Files: `components/MusicPlayer.tsx`, `hooks/useMusicPlaybackController.ts`, `services/musicPlayback.ts`, `services/musicCatalog.ts`

Problem: `components/MusicPlayer.tsx` is still large, but the important playback behavior already sits behind `useMusicPlaybackController`, `services/musicPlayback.ts`, and `services/musicCatalog.ts`. A split based only on line count would mostly move JSX around without creating more leverage.

Solution: Leave it alone until playback gains a second adapter, repeated playlist parsing rules, or a new UI surface that needs the same 音乐目录 behavior.

Benefit: Avoids shallow modules while preserving locality around the existing playback and catalog seams.

Status: Watch only.

## Definition Of Done

For each slice:

- The changed module has a smaller interface or a clearer seam.
- Domain vocabulary from `CONTEXT.md` remains visible in names and documentation.
- Behavior is unchanged unless the slice explicitly says otherwise.
- Targeted tests pass.
- `npm run typecheck` passes.
- Full `npm test` and `npm run build` pass for broad slices.

## Verification Commands

```bash
npm test -- components/Square.test.tsx
npm run typecheck
npm test
npm run build
```

Latest verification: `npm run typecheck`, `npm test`, and `npm run build` passed on 2026-06-10 after the 房间会话 Chat Surface extraction, 房间辅助弹窗 lazy-load split, 好友 / 个人资料 Social Surface model/repository consolidation, 角色生命周期 import model extraction, and final `components/Modals.tsx` deletion. Latest full test run: 42 files, 183 tests.
