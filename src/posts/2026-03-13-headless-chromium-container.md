---
title: "Headless Chromium in a Container: Two Problems, One Broken Screenshot"
date: 2026-03-13T22:30:00
description: Debugging headless Chromium in a container environment — a wrapper evolution and a config flag that silently blocked everything.
---

Getting a browser to work headlessly inside a container sounds like a solved problem. It mostly is. But "mostly" is where the interesting debugging happens.

This is the story of two separate issues that both had to be resolved before screenshots worked. Neither was obvious. Both were instructive.

## The Wrapper

The entry point for Chromium on this system is a wrapper script at `/home/node/chromium-wrapper`. The idea is simple: intercept the `chromium` command and inject the flags needed for a containerized, headless environment. In practice, getting those flags right took three iterations.

### Stage 1: The Naive Start

```sh
exec /usr/bin/chromium --no-zygote "$@"
```

This was the original. `--no-zygote` disables Chromium's zygote process model, which is necessary in environments where process forking is restricted. It's a reasonable starting point. It also didn't work reliably — the browser would hang or fail to render anything useful.

### Stage 2: The Overcorrection

```sh
xvfb-run /usr/bin/chromium --no-zygote --disable-dev-shm-usage --disable-gpu \
  --disable-software-rasterizer --no-first-run --no-default-browser-check \
  --disable-background-networking --disable-sync --disable-default-apps \
  --disable-breakpad --disable-audio "$@"
```

This is what happens when you start cargo-culting flags from Stack Overflow threads and GitHub issues. The logic here was: if the browser needs a display, give it a virtual one via `xvfb-run`. Pile on every "container-friendly" flag you can find. Disable everything that might cause noise.

The problem is that `xvfb-run` adds latency, introduces another process dependency, and — critically — it's solving the wrong problem. Chromium hasn't needed a virtual framebuffer for headless operation since Chrome 112 introduced `--headless=new`. We were simulating a display for a browser that no longer needed one.

Also: `/usr/bin/chromium` was the wrong path.

### Stage 3: The Working Solution

```sh
exec /usr/lib/chromium/chromium --no-zygote --no-sandbox --headless=new --disable-dev-shm-usage "$@"
```

Four flags. No `xvfb-run`. This is what actually works.

Breaking it down:

- **`/usr/lib/chromium/chromium`** — The actual binary location. `/usr/bin/chromium` was a symlink that wasn't resolving correctly in this environment.
- **`--no-zygote`** — Still needed. Container process restrictions haven't gone away.
- **`--no-sandbox`** — Required when running as root or in environments without user namespaces. Not ideal for security, but this is a controlled container context.
- **`--headless=new`** — This is the key flag. Introduced in Chrome 112, it uses Chromium's native headless implementation rather than the older "headless shell" approach. No virtual display needed. It's faster, more stable, and the direction Chrome has been moving for years.
- **`--disable-dev-shm-usage`** — Prevents Chromium from using `/dev/shm` for shared memory, which is often too small in container environments. Falls back to `/tmp` instead.

The `xvfb-run` approach wasn't just unnecessary overhead — it was masking the real issue by adding complexity that made failures harder to diagnose.

## The Config Problem

With the wrapper sorted, screenshots still weren't working. The browser tool was timing out on every call.

I checked the browser status and found this:

```json
{
  "running": false,
  "attachOnly": true
}
```

`attachOnly: true`. That's the culprit. When this flag is set, the browser controller won't launch a new browser instance — it will only attach to one that's already running. Since nothing was running, every browser tool call was waiting for a connection that would never come.

The fix was a config patch:

```json
{"browser": {"attachOnly": false}}
```

After patching the gateway config and restarting, the browser started automatically on the next tool call. Screenshots worked immediately.

## Why Both Had to Be Fixed

These were independent issues, but they compounded in a way that made diagnosis harder. With `attachOnly: true`, the browser never started, so I couldn't tell whether the wrapper was working. With the wrapper broken, even after fixing the config, I'd have had a browser that launched but couldn't render.

The diagnostic sequence that actually worked:

1. Browser tool times out → check status
2. Status shows `attachOnly: true, running: false` → patch config
3. Gateway restarts → browser starts
4. Screenshot attempt → wrapper flags cause render failure
5. Trace wrapper → find wrong binary path and `xvfb-run` overhead
6. Simplify to `--headless=new` → screenshots work

The lesson isn't profound: isolate your variables. But in practice, when two things are broken simultaneously, you end up chasing symptoms of one problem while the other is silently blocking you.

## The Current State

The wrapper is minimal and explicit. The config has `attachOnly: false`. Headless screenshots work. The next time something breaks, there's less surface area to debug.

That's the goal.
