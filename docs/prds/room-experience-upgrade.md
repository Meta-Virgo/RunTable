# PRD: RunTable Room Experience Upgrade

Target issue label: `ready-for-agent`

## Problem Statement

RunTable already supports core TRPG room play: room sessions, character sheets, chat, dice commands, private messages, image messages, background music, voice rooms, friends, lobby discovery, and Square community posts. The next product problem is that the room experience still feels like several capable tools sitting beside each other instead of one coherent Keeper-and-Investigator workflow.

From the user's perspective, a Keeper needs stronger control over the room membership and session flow, players need clearer shared memory of what happened, and long-running CoC games need better support for clues, character state, and post-session continuity. There is also a technical/product gap: the database has started moving room authority toward membership-backed state, but the UI still needs to fully expose and depend on that model.

## Solution

Build a staged room experience upgrade centered on three pillars:

1. Room membership and permission panel: make room membership, role, kick status, observer status, and member visibility a first-class product surface.
2. Session log and automatic after-action report: preserve meaningful play history so a room can produce a readable session record after play.
3. Clue wall / investigation board: give CoC groups a shared place to collect, organize, hide, reveal, and connect clues.

Secondary enhancements should extend naturally from those pillars: character snapshots, Keeper toolbox workflows, improved voice-room controls, invitations/scheduling, and richer CoC rule automation. These should be treated as follow-up phases unless they are needed to make the first three pillars coherent.

## User Stories

1. As a Keeper, I want to see every active room member, so that I can understand who is authorized to participate in the room.
2. As a Keeper, I want to see whether each member is a keeper, player, or observer, so that room authority is visible and not inferred from scattered UI state.
3. As a Keeper, I want to kick a disruptive or mistaken room member, so that the room remains controlled.
4. As a Keeper, I want kicked members to lose access to room messages and character visibility, so that the kick is enforced by permissions rather than only by the UI.
5. As a Keeper, I want to see which character each player has selected, so that I can manage the party cleanly.
6. As a Keeper, I want a member list that works for both text rooms and voice rooms, so that room management is consistent across modes.
7. As a Keeper, I want to distinguish online presence from active membership, so that someone leaving the screen does not accidentally remove their room authorization.
8. As a Keeper, I want to invite a player as an observer in a later phase, so that spectators can follow a session without changing play state.
9. As a player, I want to know whether I am a current active member of a room, so that access failures are understandable.
10. As a player, I want clear feedback when my room join fails because of password, closed room, kicked status, or missing character, so that I can fix the right thing.
11. As a player, I want my selected investigator to be visibly bound to the room, so that I know which character will speak, roll, and appear in logs.
12. As a player, I want private messages and secret dice visibility to respect room membership, so that confidential play content stays inside the intended audience.
13. As a room participant, I want system messages for joins, kicks, role changes, and session events, so that the room timeline explains itself.
14. As a Keeper, I want to end or archive a session with a deliberate action, so that the game history has a clear boundary.
15. As a Keeper, I want a generated session report after ending a session, so that I can share or review what happened.
16. As a player, I want the session report to include major public chat moments, so that I can remember the story.
17. As a Keeper, I want the session report to include dice rolls and their results, so that important uncertainty and checks are preserved.
18. As a Keeper, I want secret dice to be summarized in a Keeper-only section, so that the public report does not reveal hidden information.
19. As a player, I want the report to include image handouts that were shared publicly, so that visual clues are not lost in the chat stream.
20. As a Keeper, I want to add private notes before finalizing a report, so that I can preserve context for future sessions.
21. As a player, I want a readable timeline instead of a raw chat dump, so that the session record is useful after the game.
22. As a Keeper, I want character state snapshots captured at session end, so that HP, SAN, MP, inventory, and notes reflect the end of play.
23. As a player, I want to review my own character snapshot from a completed session, so that long-running campaign continuity is easier.
24. As a Keeper, I want to restore or compare a previous character snapshot in a later phase, so that accidental edits can be diagnosed.
25. As a Keeper, I want to create clue entries during play, so that important information is not buried in chat.
26. As a Keeper, I want clues to start hidden by default when appropriate, so that I can prepare information before revealing it.
27. As a Keeper, I want to reveal a clue to the room, so that players can investigate it together.
28. As a player, I want revealed clues collected on a shared investigation board, so that the group has a common memory.
29. As a player, I want to tag clues as person, place, item, event, or custom categories, so that the investigation is easier to scan.
30. As a player, I want to link related clues, so that theories can emerge visually.
31. As a Keeper, I want to attach clues to chat messages, images, or character notes where possible, so that the source context is preserved.
32. As a Keeper, I want to remove or correct a clue, so that mistakes can be fixed without confusing the table.
33. As a player, I want to see who created or last edited a clue, so that the board remains trustworthy.
34. As a Keeper, I want Keeper-only clue notes, so that I can track hidden meanings behind public evidence.
35. As a player, I want the clue wall to remain available after a session ends, so that it supports multi-session campaigns.
36. As a Keeper, I want a toolbox for quick NPC or monster speaking identity, so that switching voices in chat is fast.
37. As a Keeper, I want saved NPC and monster templates, so that recurring characters do not need to be recreated.
38. As a Keeper, I want batch secret rolls, so that hidden checks do not interrupt the flow of play.
39. As a Keeper, I want scene presets with description, music, and handouts in a later phase, so that prepared scenes can be launched quickly.
40. As a voice-room Keeper, I want to see voice connection state per participant, so that I can tell who is actually connected.
41. As a voice-room Keeper, I want mute controls in a later phase, so that table moderation is possible during voice play.
42. As a voice-room participant, I want clearer reconnect and error states, so that voice failures are actionable.
43. As a Keeper, I want room invitation links in a later phase, so that bringing players into a game is simple.
44. As a player, I want game scheduling and reminders in a later phase, so that I know when a room is expected to start.
45. As a CoC player, I want growth checks and SAN changes to be easier to record in a later phase, so that rules bookkeeping is less manual.
46. As a Keeper, I want opposed checks and bonus/penalty dice automation in a later phase, so that common CoC rolls are fast and consistent.
47. As a maintainer, I want the permission model to be testable at the session and service boundary, so that future room features do not regress security.
48. As a maintainer, I want UI tests to focus on visible room behavior, so that refactors can happen without brittle implementation-coupled tests.
49. As a maintainer, I want the first release to complete the membership-backed room flow before adding large new systems, so that the product foundation is solid.
50. As a maintainer, I want later features to reuse room session, character lifecycle, message log, music catalog, and voice-room boundaries, so that RunTable grows without another large monolith.

## Implementation Decisions

- Treat the first deliverable as a coherent MVP: membership panel, membership-backed room role state, session report, and a minimal clue wall.
- Use the existing room session module as the highest application seam for join, restore, leave, kick, room metadata, music state, voice state, characters, and message log behavior.
- Use the existing room service boundary for room membership RPCs, room catalog data, activity counts, and kick/join operations.
- Keep `room_members` as the authorization source for room membership. Do not introduce a parallel frontend-only membership model.
- Distinguish active membership from online presence. Active membership controls authorization; presence controls online indicators.
- Keep room discovery public through the lobby catalog while protecting room content through membership, message, and character visibility rules.
- Drive Keeper/player/observer UI permissions from membership-backed results wherever possible, instead of deriving everything from the room owner field in the UI.
- Preserve current text room and voice room creation flows, but expose membership state consistently in both room types.
- For kicking a member, rely on the existing membership transition contract and ensure the UI reflects the resulting status.
- The session report should be generated from existing messages, dice logs, image messages, system messages, and character state rather than inventing a separate play transcript source.
- The first report version can be deterministic and structured; AI-generated prose summaries can be a later enhancement.
- Secret dice and private messages must not leak into public reports. Keeper-only report sections are acceptable when the viewer is the room Keeper.
- Character snapshots should be captured at explicit session boundaries first. Full rollback and comparison can be a later phase.
- The clue wall should begin with simple CRUD, reveal/hide state, tags, and links. Drag-and-drop layout can be introduced after the data model is stable.
- Clue visibility should follow room membership and Keeper authority. Hidden clue notes must remain Keeper-only.
- The existing clue-wall database direction should be reused if compatible; avoid designing a second clue system without checking the existing schema.
- Voice-room enhancements should not block the membership/report/clue MVP. Keep voice work limited to surfacing clearer connection state unless included in a follow-up phase.
- CoC rule automation should build on the existing tabletop command model and dice message types rather than becoming a separate roller.
- Background music and scene presets should reuse the current music catalog and synchronized music state.
- Keep large UI refactors opportunistic and local to the room experience. Do not rewrite the entire app shell as part of this PRD.

## Testing Decisions

- Good tests should assert external behavior: what a Keeper, player, observer, kicked user, or non-member can see and do. Avoid tests that only assert internal React state shape.
- Test the room session seam for join, restore, role derivation, selected character, kick behavior, and room cleanup.
- Test the room service seam for membership-backed join and kick contracts, including password rooms and closed/completed rooms where practical.
- Test message/report generation as a pure or mostly pure transformation from room logs, dice records, image messages, visibility rules, and character snapshots into report sections.
- Test clue-wall behavior at the service/reducer boundary: create clue, reveal clue, hide clue, edit tags, link clues, delete clue, and enforce Keeper-only notes.
- Test UI behavior at a high level where feasible: Keeper sees management controls, player does not; kicked users receive actionable feedback; public reports omit secret/private content.
- Reuse existing Vitest setup and service tests as prior art. Existing voice-token tests are a good example of testing service contracts without rendering the entire app.
- Run typecheck and build before shipping implementation work.
- For user-visible room behavior, perform at least one browser smoke test covering room creation/join, member panel visibility, and report/clue navigation.

## Out of Scope

- Full AI-written narrative recaps in the first release.
- Full drag-and-drop investigation board layout in the first release if basic clue data and visibility are not yet stable.
- Mobile-native push notifications.
- Full calendar integration for scheduling.
- Complete CoC rules automation beyond the current dice command path.
- Replacing Supabase Presence with `room_members` for online state.
- Rewriting the entire room UI or app shell.
- Changing the GitHub/Vercel/Supabase deployment workflow.
- Building a standalone desktop or mobile app.

## Further Notes

The recommended implementation order is:

1. Finish the membership-backed room authority model and expose it as a room member/permission panel.
2. Add session report generation using existing room logs and character state.
3. Add a minimal clue wall that respects room membership and Keeper-only visibility.
4. Follow with character snapshots, Keeper toolbox, voice controls, invitations/scheduling, and deeper CoC automation.

This PRD intentionally starts with the membership panel because it turns a partially completed security and schema direction into a user-visible product feature. It also creates a reliable foundation for reports, clue visibility, private messages, voice-room access, and future observer mode.
