# PRD: Square Markdown posts and editor

## Problem Statement

RunTable 的广场信息流已经支持频道、帖子、图片、评论、引用评论、点赞、通知和实时新帖，但帖子正文与评论正文仍以普通文本为主。用户在广场发布招募、模组分享、战报、规则整理、反馈或长篇经验时，无法用稳定、可复制、跨平台的格式表达层级、引用、列表、链接、代码块或重点信息。

从用户视角看，广场的内容越来越像论坛帖子，而不是即时聊天消息。继续使用纯文本会让长帖难读、编辑成本高，也让从 GitHub、论坛、Obsidian、AI 生成内容或其他 Markdown 工具复制过来的内容丢失结构。用户希望广场帖子和编辑方式改为 Markdown 格式，并参考成熟论坛的写作方式，让 RunTable 广场更适合沉淀可复读的跑团内容。

## Solution

将广场帖子和评论的正文标准化为 Markdown 源文存储、Markdown 安全渲染展示、Markdown-aware 编辑体验。发帖和评论输入框仍保留轻量快速发布能力，但提供 Markdown 帮助、预览、常用格式工具和明确的编辑模式，让用户能像在 GitHub、Stack Overflow、Reddit 桌面端或 Discourse 类论坛中一样，用纯文本语法写出结构化内容。

核心体验是“源文可控、预览可信、展示安全”。用户输入的 Markdown 作为唯一正文源保存到帖子和评论的现有内容字段；列表流、详情弹窗、评论区、引用块、通知摘要和搜索都从同一份源文派生。广场不引入独立富文本存储，也不把房间聊天指令或跑团指令当成 Markdown 处理。

## User Stories

1. As a Square reader, I want post content to render headings, lists, quotes, links, emphasis, inline code, and code blocks, so that long forum-style posts are easier to scan.
2. As a Square author, I want to write posts in Markdown source text, so that I can compose content with familiar syntax instead of fighting a custom rich text editor.
3. As a Keeper, I want to publish a campaign recruitment post with headings, bullet requirements, schedule details, and links, so that players can understand the offer quickly.
4. As a player, I want to post a character idea with sections and lists, so that feedback is easier to organize.
5. As a module creator, I want to share resources with links, quotes, and code-like stat blocks, so that other Keepers can copy and reuse them.
6. As a battle report author, I want to write long reports with nested sections, images, and emphasized highlights, so that the story remains readable after publication.
7. As a rules-discussion participant, I want inline code and fenced code blocks, so that dice formulas, commands, and rule snippets do not get confused with normal prose.
8. As a feedback author, I want task-list style Markdown to render readably, so that product suggestions can be organized as checkable points even if they are not interactive tasks.
9. As a mobile author, I want Markdown editing to remain usable in a single text area, so that the feature does not depend on a desktop-only rich editor.
10. As a desktop author, I want a preview mode before publishing, so that I can confirm how my post will render.
11. As a fast poster, I want the default editor to stay quick and lightweight, so that short posts are not slowed down by a heavy composer.
12. As a Markdown beginner, I want a compact formatting helper for bold, italic, link, quote, list, and code block syntax, so that I can learn without leaving the page.
13. As an experienced Markdown user, I want pasted Markdown to remain source text, so that formatting does not get silently rewritten.
14. As an author pasting from Obsidian, GitHub, or AI output, I want common Markdown syntax to survive publication, so that I do not have to manually rebuild structure.
15. As an author adding images, I want the existing paste/drag image flow to remain available, so that Markdown support does not remove current image posting.
16. As a reader, I want unsafe HTML or script-like content to be ignored or sanitized, so that rendered Markdown cannot execute hostile markup.
17. As a reader, I want external links to be clearly clickable and safe, so that Markdown links are useful without exposing the app to unsafe navigation behavior.
18. As a reader, I want very long Markdown posts in the list view to remain compact, so that the feed stays scannable.
19. As a reader, I want the detail modal to show the full rendered Markdown, so that I can read long posts comfortably.
20. As a commenter, I want comments to support the same core Markdown subset as posts, so that replies can quote, list, link, and format short arguments.
21. As a commenter, I want comment input to preview Markdown, so that I can verify formatting before sending.
22. As a participant replying to a comment, I want quoted comments to render as safe, compact excerpts, so that replies remain understandable without nesting full rendered documents.
23. As a reader scanning the feed, I want latest-comment previews to show a plain-text summary of Markdown comments, so that formatting markers do not clutter the preview.
24. As a user receiving notifications, I want notification snippets to use readable plain-text excerpts, so that Markdown source syntax does not make notifications noisy.
25. As a search user, I want search to match the Markdown source text and readable words, so that links, headings, and list items remain discoverable.
26. As a post owner, I want existing delete behavior to keep working for Markdown posts, so that content ownership stays unchanged.
27. As a post owner, I want future editing to be possible against the Markdown source, so that the source remains the canonical editable body.
28. As a moderator-like future role, I want Markdown rendering rules to be centralized, so that policy changes can be made consistently across posts and comments.
29. As a developer, I want one Markdown rendering adapter used by feed cards, detail modals, comments, quote excerpts, and notifications, so that output stays consistent.
30. As a developer, I want Markdown parsing and sanitization to be covered by focused tests, so that XSS and broken rendering regressions are caught.
31. As a developer, I want the database migration to be minimal or unnecessary, so that existing posts continue to display and remain editable.
32. As a developer, I want existing plain-text posts to render as valid Markdown paragraphs, so that no backfill is required.
33. As a product owner, I want the Markdown feature to follow common forum conventions, so that users do not need to learn a RunTable-only markup language.

## Implementation Decisions

- The feature belongs to the 广场信息流 domain. It should not change room session chat, 跑团指令 parsing, dice commands, private room messages, or Keeper/player room workflows.
- Store Markdown source as the canonical body in the existing post and comment content fields. Existing plain-text content remains valid Markdown and should render as equivalent paragraphs.
- Add a Markdown rendering adapter that receives source text and returns safe rendered React output. All rendering surfaces should use this adapter instead of directly printing content.
- Use a conservative Markdown subset for the first implementation: paragraphs, headings, bold, italic, strikethrough if supported by the chosen parser, blockquotes, unordered lists, ordered lists, inline code, fenced code blocks, links, horizontal rules, and images only when they come from existing trusted post image handling or an explicitly allowed remote-image policy.
- Do not allow raw HTML execution. If the chosen Markdown parser supports raw HTML, disable it or sanitize it before React rendering.
- Treat Markdown image syntax separately from the existing Supabase Storage post image attachment. The first implementation should keep the current paste/drag image upload path and may either disable remote Markdown images or render them only under an allowlisted/sanitized policy.
- Add editor mode controls for source and preview. On desktop, preview can be side-by-side or tabbed depending on available width. On mobile, source and preview should be tabbed to preserve space.
- Add a compact Markdown toolbar for common syntax insertion: bold, italic, link, quote, bulleted list, numbered list, inline code, and fenced code block. The toolbar inserts Markdown source into the text area; it does not create a second rich-text representation.
- Keep the fast-post path: a user can type plain text and publish without opening preview or using toolbar controls.
- Apply the same Markdown source model to comments, with a more compact editor and preview because comments are lower ceremony than posts.
- Feed cards should render Markdown in a constrained preview mode: headings are visually smaller than detail view, long content is clamped, code blocks do not expand the card uncontrollably, and link clicks do not accidentally open the detail modal.
- Detail modal should render the full Markdown body with richer spacing and safe wrapping for long links, code blocks, and tables if tables are later added.
- Comment previews and notification snippets should use a plain-text excerpt derived from Markdown source, not raw source and not rendered HTML.
- Quote previews should use a plain-text excerpt from the quoted comment. Full nested Markdown rendering inside a quote is out of scope for the first version.
- Search can continue to operate on source content in the first version, because source contains the readable words. If parser-derived plain text becomes necessary, it should be centralized in the Markdown adapter.
- Existing real-time new-post handling should render incoming Markdown through the same adapter as fetched posts.
- The TypeScript types can keep `content` as a string. If needed, introduce derived UI helper fields such as plain-text excerpt, but do not duplicate the source body in the database.
- The chosen Markdown library should be React-friendly, maintained, and compatible with Vite. It should support sanitization or compose cleanly with a sanitizer.
- Styling should be scoped to Square Markdown bodies, so Markdown headings, lists, blockquotes, code blocks, and links do not leak global styles into room surfaces.
- The feature should preserve existing post likes, comment likes, delete flows, image upload, channel filtering, search, notification loading, and Supabase RLS behavior.

## Testing Decisions

- Tests should assert user-observable behavior: source Markdown renders as expected, unsafe input does not execute or render unsafe markup, plain text remains readable, previews and excerpts are stable, and existing Square actions still work.
- Add unit tests for the Markdown adapter covering supported syntax, escaped or disabled raw HTML, safe links, code blocks, plain-text excerpt extraction, and empty/whitespace input.
- Add component-level tests for the Square post composer that verify source entry, preview switching, toolbar insertion, publish enablement, and existing image attachment compatibility.
- Add component-level tests for post cards and detail modal rendering the same Markdown source in preview and full modes.
- Add comment-focused tests for Markdown comment creation, rendered comment display, quote excerpt display, and latest-comment preview text.
- Add a regression test that existing plain-text posts and comments render without visible Markdown-specific artifacts.
- Add a regression test for realtime-inserted posts if the existing Square feed hook tests are introduced or expanded; otherwise cover the formatting function or adapter used by realtime formatting.
- Prior art in the repo is behavior-focused Vitest coverage in service modules and React component tests for room tools/sidebar. Follow that pattern instead of snapshot-heavy tests.
- A browser smoke test should cover creating a Markdown post, previewing it, publishing it, opening detail view, adding a Markdown comment, and confirming the feed/comment previews remain readable.

## Out of Scope

- Replacing the Square composer with a full WYSIWYG editor.
- Markdown support inside room chat or 跑团指令 input.
- Collaborative editing, drafts synced across devices, or autosave.
- Rich moderation workflows, post edit history, or version diffing.
- Backfilling or migrating existing plain-text posts.
- Supporting every GitHub-Flavored Markdown extension in the first release, including tables, footnotes, alerts, diagrams, math, mentions, issue autolinks, or embedded HTML.
- Making Markdown task lists interactive checkboxes.
- Uploading images by writing arbitrary Markdown image syntax, unless a safe allowlisted policy is explicitly added.

## Further Notes

- External references: GitHub demonstrates Markdown as a familiar web writing surface with headings, lists, code blocks, links, task lists, and other extensions; Stack Overflow uses Markdown/HTML formatting for posts and limits comments to a smaller subset; Reddit currently distinguishes rich text and Markdown editors and notes that Markdown remains a desktop web path.
- Product direction: RunTable should choose a Markdown-source-first composer rather than a rich-text-first composer for this iteration. It is simpler, more predictable for power users, easier to test, and fits the user's request to change posts and editing to MD format.
- The implementation should prefer a small, centralized Markdown module before touching all Square rendering surfaces. That gives future agents a clean vertical slice: parser/sanitizer/excerpt first, post rendering second, composer preview third, comments fourth.
