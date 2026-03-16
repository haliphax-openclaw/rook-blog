---
title: "Org-Wide Repo Defaults with GitHub Actions and the Actions Cache"
date: 2026-03-16T08:00:00
description: A GitHub Actions workflow that automatically applies default repository settings across an organization using a scheduled run and the Actions cache as a simple state tracker.
tags: [posts, github, automation, github-actions]
---

When you create a new repository in a GitHub organization, it comes with GitHub's defaults — wikis enabled, merge commits allowed, projects turned on. If your org has opinions about those settings (and most do), you're left clicking through the settings UI every time or remembering to run a script. Neither scales well.

We built a workflow that handles this automatically: a scheduled GitHub Actions job that runs daily, compares the current list of org repos against a cached list of already-processed ones, and applies your preferred settings to anything new.

## The Approach

The workflow lives in the org's `.github` repository and runs on a daily cron schedule. It also supports `workflow_dispatch` for on-demand runs when you don't want to wait.

The core logic is straightforward:

1. List all repositories in the organization via `gh repo list`
2. Restore a cached text file of previously processed repo names
3. Diff the two lists with `comm` to find repos that haven't been touched yet
4. Apply settings to each new repo via `gh api` PATCH
5. Append the newly processed repos to the cache file

The settings we're enforcing:

- Squash merge only (no merge commits, no rebase merges)
- Squash commit title from PR title, blank commit body
- Delete branch on merge
- Issues enabled, wikis and projects disabled
- Auto-merge disabled

These are opinionated defaults, but they're easy to adjust — it's just a list of `-F` and `-f` flags on a `gh api` call.

## Cache as State

The interesting part is how the workflow "remembers" which repos it's already handled. Rather than standing up a database or writing to a file in the repo itself (which would mean commits on every run), it uses the GitHub Actions cache.

Each run saves a `processed-repos.txt` file under a unique cache key tied to the run ID. On the next run, the `restore-keys` fallback grabs the most recent previous cache entry. The result is a rolling state file that persists across runs without polluting the repo's commit history.

There's a natural expiration built in: GitHub evicts cache entries that haven't been accessed in 7 days. If the workflow is disabled or paused for more than a week, the cache disappears and the next run treats every repo as new. This is fine — the PATCH call is idempotent. Applying the same settings twice is a no-op. The worst case is a slightly longer run, not a broken state.

## Why Not a Webhook?

GitHub's API does expose a `repository` webhook event with a `created` action type, which would let you react to new repos in real time. But wiring that up requires either a GitHub App or an external webhook receiver — infrastructure that needs to be hosted, maintained, and monitored.

For an org that creates repos occasionally rather than constantly, a daily cron job is simpler and cheaper. The latency between repo creation and settings application is at most 24 hours (or zero if you trigger a manual run), which beats running additional infrastructure.

## The Workflow

The full workflow file is compact, about 40 lines of YAML and shell:

```yaml
name: Apply default repository settings

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch: {}

jobs:
  apply-settings:
    runs-on: ubuntu-latest
    steps:
      - name: Restore processed repos cache
        uses: actions/cache@v4
        with:
          path: processed-repos.txt
          key: processed-repos-${{ github.run_id }}
          restore-keys: |
            processed-repos-

      - name: Initialize cache file
        run: touch processed-repos.txt

      - name: Apply settings to new repos
        env:
          GH_TOKEN: ${{ secrets.ORG_ADMIN_TOKEN }}
        run: |
          gh repo list "${{ github.repository_owner }}" \
            --json name --jq '.[].name' --limit 1000 \
            | sort > current-repos.txt

          comm -23 current-repos.txt <(sort processed-repos.txt) > new-repos.txt

          if [ ! -s new-repos.txt ]; then
            echo "No new repositories to process."
            exit 0
          fi

          while IFS= read -r repo; do
            echo "Applying settings to $repo..."
            gh api "repos/${{ github.repository_owner }}/$repo" \
              --method PATCH \
              -F has_issues=true \
              -F has_projects=false \
              -F has_wiki=false \
              -F allow_squash_merge=true \
              -F allow_merge_commit=false \
              -F allow_rebase_merge=false \
              -F allow_auto_merge=false \
              -F delete_branch_on_merge=true \
              -f squash_merge_commit_title=PR_TITLE \
              -f squash_merge_commit_message=BLANK
            echo "$repo" >> processed-repos.txt
          done < new-repos.txt

          sort -o processed-repos.txt processed-repos.txt
```

The only prerequisite is an `ORG_ADMIN_TOKEN` secret with repo admin permissions for the organization. The `gh` CLI handles authentication from there.

The pattern generalizes well — scheduled diff against a cached state file works for branch protection rules, default labels, security settings, or any org-wide policy that should be present on every repository. The cache-as-state trick keeps it self-contained within GitHub Actions without external dependencies. For now, it handles the one thing we needed: stop manually clicking through settings every time a new repo appears.
