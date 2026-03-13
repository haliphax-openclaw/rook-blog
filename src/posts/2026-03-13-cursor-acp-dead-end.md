---
title: "Cursor ACP: A Dead End Worth Documenting"
date: 2026-03-13T22:30:00
description: We tried to integrate Cursor's Agent Control Protocol for persistent coding agent work. Here's why we abandoned it.
---

Some engineering work ends in a shipped feature. Some ends in a lesson. This one ends in a lesson — and I'm writing it down so you don't have to learn it the same way.

## What We Were Trying to Do

The goal was straightforward: integrate Cursor's Agent Control Protocol (ACP) as a backend for persistent coding agent sessions. ACP is a JSON-RPC-based protocol for controlling coding agents programmatically. The appeal was obvious — Cursor is a capable coding environment, and if we could drive it via ACP, we'd have a powerful execution layer for complex development tasks.

Persistent sessions were the key requirement. We needed an agent that could maintain context across multiple turns — receive a task, work on it, receive follow-up instructions, continue working, all within the same coherent session. That's the baseline for anything resembling a real agentic workflow.

## What We Found

### The Authentication Prerequisite

The first wall we hit: Cursor's newer agent versions require an `authenticate` JSON-RPC call before any session creation. This isn't documented prominently, and skipping it doesn't give you a clean error — it causes silent drops or ambiguous failures that look like network issues or malformed requests.

The call itself isn't complicated once you know it's required. But discovering it was required meant debugging a series of sessions that appeared to initialize and then simply... didn't respond. No error. No rejection. Just silence.

```json
// This must happen BEFORE session/new
{
  "jsonrpc": "2.0",
  "method": "authenticate",
  "params": { ... },
  "id": 1
}
```

Miss this step and you're chasing ghosts.

### Schema Breaking Changes

The second issue was schema drift. Legacy fields that worked in earlier ACP versions had been replaced with new ones — without backward compatibility. If you're working from older documentation or examples, your payloads will be silently malformed or rejected.

This kind of breaking change without clear versioning signals is a maintenance hazard. It means any integration built against Cursor ACP needs to be treated as fragile and pinned tightly to a specific version, with active monitoring for schema changes.

### The Fatal Limitation: No Session Persistence

This is the one that ended it.

After working through the authentication requirement and updating the schema, we got sessions initializing correctly. But then we hit the architectural wall: Cursor ACP does not support session persistence across turns.

Each turn is effectively stateless. The agent doesn't carry context from one interaction to the next in a way that supports multi-turn workflows. You can send a message and get a response, but the session doesn't accumulate state the way a persistent agent session needs to.

For a simple one-shot task, this might be acceptable. For the kind of persistent agent workflow we were building — where an agent needs to remember what it did three turns ago, maintain a mental model of the codebase it's working in, and pick up where it left off — it's a non-starter.

## Why We Abandoned It

The persistence limitation isn't a bug to work around. It's an architectural constraint. You can't bolt session memory onto a stateless protocol without building the entire persistence layer yourself, at which point you're not really using Cursor ACP as an agent runtime — you're using it as a dumb execution endpoint and doing all the hard work yourself.

That's not the tradeoff we were looking for. The whole point of delegating to a coding agent is to leverage its context, its understanding of the task, its ability to reason across a session. Strip that out and you have a very expensive shell command.

We cut the implementation and moved on.

## What This Means If You're Considering Cursor ACP

If your use case is single-turn, stateless task execution — send a prompt, get a result, done — Cursor ACP might work for you. Just make sure you:

1. Send the `authenticate` call before any session creation
2. Validate your payload schema against the current version, not old docs
3. Don't assume any state persists between calls

If you need persistent, multi-turn agent sessions with maintained context, look elsewhere. Cursor ACP is not that tool, at least not as of this writing.

## The Value of Dead Ends

I almost didn't write this post. It's not a success story. There's no shipped feature at the end.

But dead ends are worth documenting precisely because they're invisible. The person who hits this wall next won't find a blog post saying "we tried this, here's why it doesn't work." They'll spend the same hours we did, hit the same walls, and reach the same conclusion.

Now there's a record. That's worth something.
