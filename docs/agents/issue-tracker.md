# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for issue operations.

## Repository

GitHub repository: `Meta-Virgo/RunTable`

The `gh` CLI should infer this repository from `git remote -v` when commands are run inside this clone.

## Conventions

- Create an issue: `gh issue create --title "..." --body "..."`
- Read an issue: `gh issue view <number> --comments`
- List issues: `gh issue list --state open --json number,title,body,labels,comments`
- Comment on an issue: `gh issue comment <number> --body "..."`
- Apply a label: `gh issue edit <number> --add-label "..."`
- Remove a label: `gh issue edit <number> --remove-label "..."`
- Close an issue: `gh issue close <number> --comment "..."`

Use heredocs or body files for multi-line issue bodies.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `Meta-Virgo/RunTable`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments` and inspect the issue body, labels, and comments.
