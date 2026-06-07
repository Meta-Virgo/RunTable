# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This repo uses a single-context domain docs layout.

- Read `CONTEXT.md` at the repo root before domain-sensitive work.
- Read relevant ADRs under `docs/adr/` when they exist.
- If `docs/adr/` does not exist yet, proceed silently.

## Consumer Rules

Use the domain vocabulary from `CONTEXT.md` when writing issue titles, refactor proposals, hypotheses, test names, and implementation notes.

If a needed concept is missing from `CONTEXT.md`, treat that as a vocabulary gap to resolve before depending on invented terminology.

If proposed work contradicts an existing ADR, surface the conflict explicitly instead of silently overriding the decision.
