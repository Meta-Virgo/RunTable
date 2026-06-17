# PRD: Module Marketplace Room Presets

Target issue label: `ready-for-agent`

## Problem Statement

RunTable already has a usable room session foundation: Keepers can create rooms, edit room title/description/cover, manage NPCs and monsters, prepare room scenes, move tokens on the scene/tabletop surface, run background music, invite players, and rely on membership-backed room permissions. However, every new game still starts from an empty or mostly manual room.

From the user's perspective, a Keeper who wants to run a ready-made module has to copy the story background, create the room, upload or select a cover, recreate NPCs and monsters, rebuild scenes, place tokens, prepare handouts, and only then invite investigators. This makes RunTable good at running a room after setup, but weak at helping a group start a prepared session quickly.

The product gap is a "module marketplace" or "module square": a browsable area containing many preset modules where a user can choose one and directly generate a playable room. The generated room should already contain the module background, cover, NPCs/monsters, prepared scenes, and starter information so that investigators can join and begin play with minimal Keeper setup.

## Solution

Build a Module Marketplace that exposes curated preset module templates and lets an authenticated user instantiate a template into a new RunTable room.

The core experience is:

1. A user browses preset modules from a dedicated marketplace surface.
2. A user opens a module detail page to inspect cover, summary, tags, estimated duration, player count, tone/content notes, public player-facing premise, Keeper-facing preparation notes, NPC/monster roster, and scene preview.
3. A user clicks "Create room from module", chooses room settings such as room title, room type, visibility/password, and optional cover override.
4. RunTable creates a new room where the user is the Keeper.
5. The generated room copies the module's room metadata, cover, background information, Keeper notes, NPCs/monsters, scenes, scene markers/tabletop tokens, starter clue-wall data where available, and optional music state into room-owned records.
6. The Keeper lands in the newly created room and can invite investigators immediately.

The first release should focus on curated preset templates and one-click room generation. It should not require a full user-generated marketplace, review workflow, monetization system, or public module authoring suite before Keepers can use the feature.

## User Stories

1. As a Keeper, I want to browse a marketplace of preset modules, so that I can quickly find a prepared game to run.
2. As a Keeper, I want each module card to show a cover image, title, short premise, tags, player count, and estimated duration, so that I can compare modules without opening every detail page.
3. As a Keeper, I want to filter modules by system, genre, tags, player count, duration, and complexity, so that I can find something suitable for tonight's table.
4. As a Keeper, I want to search module titles, summaries, tags, NPC names, and author names, so that known modules are easy to find.
5. As a Keeper, I want to open a module detail page, so that I can inspect the full premise and preparation content before creating a room.
6. As a Keeper, I want to distinguish player-facing information from Keeper-only secrets, so that previews do not spoil the investigation for players.
7. As a Keeper, I want to see the prepared NPC and monster roster before creating a room, so that I understand what characters will be copied into the room.
8. As a Keeper, I want to see prepared scene names and thumbnails or map summaries, so that I can judge whether the module has enough play support.
9. As a Keeper, I want to see content warnings and tone notes, so that I can choose modules appropriate for my group.
10. As a Keeper, I want to see whether a module includes prepared background music or ambience, so that I know how much atmosphere is already set up.
11. As a Keeper, I want to create a room from a module with one clear action, so that setup does not become another manual checklist.
12. As a Keeper, I want to customize the generated room title before creation, so that I can name the room for my campaign or group.
13. As a Keeper, I want to choose text or voice room type during module instantiation, so that the module works with the way my group plays.
14. As a Keeper, I want to choose whether the generated room is public, password-protected, or invitation-oriented, so that access matches my table.
15. As a Keeper, I want the generated room cover to default to the module cover, so that the lobby card looks prepared immediately.
16. As a Keeper, I want the generated room description to include the module's player-facing premise, so that investigators can understand the setup before joining.
17. As a Keeper, I want Keeper-only module notes to be available inside the room, so that secrets are not mixed into public room description.
18. As a Keeper, I want all module NPCs and monsters to be copied into the room as room-owned NPC/monster characters, so that I can use them in chat, dashboard, commands, and tokens.
19. As a Keeper, I want copied NPCs and monsters to preserve stats, skills, avatar, notes, backstory, items, spells, and type, so that they are ready for play.
20. As a Keeper, I want copied NPCs and monsters to be independent from the marketplace template after creation, so that room edits do not mutate the original module.
21. As a Keeper, I want prepared scenes to be copied into the room scene workspace, so that I can switch scenes during play without rebuilding them.
22. As a Keeper, I want prepared tabletop maps, fog/reveal state, shapes, and token placements to be copied where available, so that the tactical scene starts ready.
23. As a Keeper, I want NPC and monster tokens to start hidden when the template marks them hidden, so that investigators do not see unrevealed threats.
24. As an investigator, I want only player-safe room information and revealed scene content to be visible, so that the module's secrets remain protected.
25. As an investigator, I want to join a generated module room using my own investigator, so that my character remains mine and is not silently replaced by template data.
26. As a Keeper, I want optional pregenerated investigators to be visible as importable choices, so that one-shot groups can start quickly without forcing ownership changes.
27. As an investigator, I want to import a pregenerated investigator into my library before joining, so that I intentionally own the character I will play.
28. As a Keeper, I want starter clue-wall entries or handouts to be copied into the room when a module includes them, so that the investigation board begins with the correct public and hidden information.
29. As a Keeper, I want prepared module handouts to preserve images and descriptions, so that clues do not need to be reposted manually.
30. As a Keeper, I want background music metadata to default from the module, so that the room atmosphere is available immediately.
31. As a Keeper, I want to review what will be created before confirming, so that I do not accidentally generate the wrong room.
32. As a Keeper, I want clear progress and error states during room generation, so that partial setup failures are understandable.
33. As a Keeper, I want room generation to be atomic enough that a failed template does not leave a broken room full of partial data, so that cleanup is not manual.
34. As a Keeper, I want successful generation to take me directly into the new room, so that I can continue setup or invite investigators.
35. As a Keeper, I want the generated room to behave like any normal RunTable room, so that existing invite, membership, chat, scene, music, and conclusion flows still work.
36. As a player browsing the marketplace, I want to see player-safe module details without Keeper-only spoilers, so that I can suggest a module without ruining it.
37. As a user, I want marketplace loading states and empty states, so that I understand whether there are no matching modules or the app is still fetching.
38. As a user, I want module cards to remain readable on mobile, so that I can browse from a phone before a session.
39. As a maintainer, I want preset module data to have an explicit template schema, so that room-owned runtime records are not confused with reusable catalog records.
40. As a maintainer, I want template instantiation to go through an authoritative backend boundary, so that permissions and copied record ownership are enforced consistently.
41. As a maintainer, I want template records to be read-only to normal users in the first release, so that curated content cannot be corrupted from the client.
42. As a maintainer, I want the generated room to use existing room, character, scene, tabletop, clue-wall, music, and membership concepts, so that the feature does not create a parallel game runtime.
43. As a maintainer, I want test coverage around template-to-room instantiation, so that later module formats do not break playable room generation.
44. As a maintainer, I want marketplace UI tests to focus on user-observable browsing and create-room behavior, so that implementation details can evolve.
45. As a product owner, I want the first release to support curated preset modules before full user publishing, so that we can validate the play-start workflow first.

## Implementation Decisions

- Treat "module template" and "room instance" as separate concepts. A template is reusable catalog content; a room instance is normal room-owned runtime data created from that template.
- Add a marketplace/catalog data model for preset module templates. It should cover public metadata, player-facing premise, Keeper-only preparation notes, cover image, tags, system, estimated duration, recommended player count, difficulty/complexity, NPC/monster definitions, scene definitions, optional tabletop state, optional clue/handout seeds, and optional music defaults.
- Normal users should be able to read published marketplace templates, but first-release writes should be limited to seeded/admin/curated content. Full user-submitted module publishing is a later workflow.
- Do not model preset modules as ordinary Square posts in the first release. Existing Square post modules are useful for sharing character summaries and room log excerpts, but marketplace templates need stronger structure, hidden Keeper-only data, and an instantiation contract.
- The marketplace can reuse Square-style feed/card patterns where helpful, but it should have its own filtering, detail, and "create room from module" flow.
- Room generation should go through an authoritative backend function or service boundary rather than a client-side chain of inserts. The boundary should create the room, assign the caller as Keeper, copy template records into room-owned records, and return the generated room id.
- The generated room should use existing room metadata fields for title, description, cover, type, status, password state, background music URL, and synchronized music state where applicable.
- The generated room should create the caller's active Keeper membership through the existing membership model, preserving the membership-backed authority direction.
- Template NPCs and monsters should be copied into existing character records with room ownership and type set to NPC or monster. These copied records must not reference the template as editable source of truth.
- Template pregenerated investigators, if included in the first release, should be importable by players rather than silently created as player-owned room members. Player-owned investigator identity should remain explicit.
- Template scenes should be copied into the existing room scene model. Active scene state should follow the template's active/default scene.
- Template tabletop data should be translated into existing tabletop scene, token, shape, fog, and persisted document concepts where available. If a template only has legacy scene data, use the existing scene/marker path and let tabletop bootstrap/import behavior normalize it.
- Template tokens should be attached to copied room character ids, not template character ids. The instantiation contract must map source template entity ids to generated room entity ids.
- Hidden NPC/monster markers and tokens should remain hidden to investigators by default. Keeper visibility remains authoritative.
- Template clue-wall or handout data should reuse the existing clue wall direction if compatible, but the first implementation may restrict clue seeds to simple title/content/visibility entries if the current clue-wall model is too coarse.
- Module cover images should use existing public image URL conventions where possible. A generated room may reuse a template cover URL directly unless later storage policy requires copying assets.
- Module background information should be split into public room description and Keeper-only notes. Do not place secrets in a field visible to investigators.
- Generation should be idempotent only at the user action level: pressing create once creates one room. Creating multiple rooms from the same template is allowed and should produce independent rooms.
- A failed generation should not leave a visible broken room. Prefer a transaction-like backend flow; where a full transaction is not available, record a generation status and hide failed rooms from the lobby.
- The marketplace should expose enough template metadata for search and filtering without fetching full Keeper-only payloads for every card.
- The detail view may fetch full template content after opening the module. Keeper-only sections should be marked clearly and should not be shown to unauthenticated users if product policy requires login for spoilers.
- The first release should support a curated seed path for templates, so development and testing can work with at least one realistic module containing cover, NPC/monster roster, scenes, and room background.
- Existing room creation remains available. The marketplace adds a second creation path, not a replacement.

## Testing Decisions

- Good tests should assert external behavior: users can browse templates, inspect details, create a room, and enter a generated room whose visible data matches the template while hidden Keeper data remains protected.
- The highest-value testing seam is the template instantiation boundary: given a template and a Keeper user, it creates a normal room with copied metadata, Keeper membership, NPCs/monsters, scenes, markers/tokens, and optional starter data.
- Test the template-to-room mapper as a pure or mostly pure transformation where possible, especially source-id to generated-id mapping for characters, scenes, and tokens.
- Test backend permission behavior for marketplace templates: published templates are readable, unpublished/admin templates are not publicly listed, and normal users cannot mutate curated templates.
- Test room-generation permissions: unauthenticated users cannot instantiate; authenticated users become Keeper of the generated room; generated records are owned by the room and protected by existing room membership rules.
- Test generated character behavior at the service boundary: NPCs and monsters are copied as room characters, investigators are not automatically assigned to other users, and template edits do not mutate existing generated rooms.
- Test generated scene behavior: default active scene is set, copied markers/tokens point to copied character ids, and hidden marker/token visibility remains hidden from investigators.
- Test marketplace UI behavior: cards render metadata, filters/search narrow results, detail view separates player-safe and Keeper-only information, and the create-room confirmation displays the settings that will be applied.
- Test create-room UI behavior: success navigates to the new room, loading state prevents duplicate submission, and failure shows a clear error without joining a broken room.
- Use existing Vitest service tests as prior art for room services, room scenes, tabletop model behavior, Square feed/model tests, and membership-backed room authority tests.
- Run typecheck and build before shipping implementation work.
- For the first implemented slice, perform a browser smoke test covering marketplace browse, detail open, create from preset, generated room entry, NPC/monster roster presence, and prepared scene visibility.

## Out of Scope

- Full user-generated module publishing, moderation, approval, versioning, or takedown workflows.
- Paid marketplace, purchases, revenue share, licensing enforcement, or DRM.
- Public ratings, reviews, favorites, recommendation algorithms, or ranking personalization.
- Collaborative module authoring inside RunTable.
- Importing arbitrary external module formats.
- Automatically assigning investigators to players without explicit player import/selection.
- Replacing existing Square posts or moving all module discussion into the marketplace.
- Rewriting the room session, character lifecycle, scene workspace, tabletop runtime, clue wall, or music player as part of this PRD.
- AI-generated complete modules. AI assistance may be a later enhancement after the template schema is stable.
- Multi-system rules automation beyond storing module metadata and existing room/dice behavior.

## Further Notes

- Recommended implementation order:

1. Define the template schema and seed one realistic curated preset module.
2. Build the read-only marketplace list/detail experience.
3. Build the authoritative create-room-from-template backend boundary.
4. Wire the frontend create-room confirmation and generated-room navigation.
5. Expand template payload support from room metadata and NPC/monster roster to scenes, tabletop tokens, clue seeds, and music defaults.

- This PRD intentionally treats the marketplace as a start-of-play accelerator. The success metric for the first release is not marketplace social depth; it is whether a Keeper can select a prepared module, generate a normal RunTable room, and immediately begin inviting investigators.
