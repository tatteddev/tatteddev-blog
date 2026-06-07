---
title: 'Stop Receiving Webhooks, Start Polling: Rebuilding the Grid Review Runner'
description: 'Why I tore out an inbound webhook over a Cloudflare Tunnel and replaced it with a pull-based local worker that polls GitHub and treats labels as a durable queue.'
pubDate: 'Jun 07 2026'
heroImage: '../../assets/review-runner.png'
category: 'Development'
tags: ['architecture', 'automation', 'devops', 'honeydrunk', 'tooling']
---

Every pull request I open gets an automated code review from an AI agent before I merge it. It reads the diff, checks it against my project's conventions, and posts its findings as a comment, like a second set of eyes that never sleeps. I run a whole studio's worth of repos solo, so that reviewer is load-bearing infrastructure. I call it the Grid Review Runner.

One weekend it went quiet, and I didn't notice for two days.

A pull request sat in one of my repos with no review on it. I was on the road. When I finally opened my laptop, I had no idea whether the reviewer had looked at the PR and decided it was fine, or whether it had never been told the PR existed in the first place. There was no log to check. There was no signal either way. The review just... wasn't there.

That ambiguity is the whole story. The way the system worked back then, GitHub was supposed to *push* a notification to my reviewer the instant a PR opened (a webhook, in the usual web plumbing sense). If that push went missing, the reviewer never woke up, and nothing told me it had been skipped. Did the reviewer decline, or did the notification never fire? I couldn't tell. The runner worked beautifully when I was sitting at my desk and fell apart the moment I wasn't. So I rebuilt the transport from the ground up. This post is about that rebuild, and the one architectural decision underneath it: stop waiting to be told about work, and go looking for it instead.

## The Old Shape: Inbound Webhook Over a Tunnel

The Grid Review Runner is the piece of the HoneyDrunk Grid that runs an AI code review on pull requests. The review logic was never the problem. The rubric, the context-loading contract, the advisory posture all worked. The problem was the rail it rode in on.

The original design (ADR-0044) looked like this:

```
GitHub PR event
  → GitHub Action fires an HMAC-signed webhook
    → GitHub pushes it over a Cloudflare Tunnel
      → a local webhook bridge on my home server
        → which invokes OpenClaw/Codex to run the review
```

Every arrow there is a thing that has to be up at the exact moment a PR event happens. OpenClaw was the execution runtime. The Cloudflare Tunnel was its inbound rail. The home server (ADR-0081) was the always-on box that hosted both. On paper it's clean: GitHub talks to a narrow, signed, authenticated endpoint, and the endpoint does the work.

In practice it was three single points of failure stacked on top of each other, and all three were coupled to me.

## Why It Failed

Three failure modes compounded over the weeks after it landed:

- **Webhook delivery flaked.** GitHub redelivery is best-effort. On long PR sessions the bridge missed `synchronize` events, and I had no inexpensive way to tell whether a missing review meant "the runner declined" or "the event never arrived."
- **Tunnel uptime was coupled to me.** The Cloudflare Tunnel ran on the home server, and it was the single inbound path. When I traveled, when the box rebooted, when the tunnel daemon hiccuped, the rail was down. No rail, no review.
- **OpenClaw process stability wasn't set-and-forget.** Crashes, session-credential expiry, dashboard-coupled state. "Did the review run?" was a non-trivial question to answer, every time.

The symptoms were all different. They had one root cause: an always-on inbound HTTP receiver on operator infrastructure does not fit an operator whose laptop travels.

That shape works for a team with an on-call rotation absorbing the misses. It is mis-sized for one person and a single low-power box at home. I could have kept patching it (better redelivery handling, a hardier tunnel daemon, hardening OpenClaw against crashes), but every one of those is repair work on a house that doesn't fit the lot. The failure modes are intrinsic to the inbound-webhook shape on a solo setup. No tactical fix removes the category.

So I stopped trying to fix the rail and changed the direction it ran.

## The Pivot: Push Becomes Pull

Here is the load-bearing decision, and everything else is downstream of it: invert the transport. Instead of GitHub pushing a trigger into my infrastructure, my worker reaches out and pulls the trigger inward. The queue it pulls from is GitHub itself, so there's no server of mine that has to stay alive to hold it.

The new critical path:

```
GitHub PR event
  → cheap GitHub Action (no LLM work)
    → enqueue: add `needs-agent-review` label + structured queue comment
      → local worker polls GitHub on a 60s tick
        → claims one PR, runs the review locally under Codex CLI + Claude Code CLI
          → posts the verdict, swaps the label to its final state
```

No inbound webhook. No tunnel for review traffic. No OpenClaw on the path at all.

The GitHub Action got dumber on purpose. It does exactly two API calls and exits: it normalizes the PR's managed labels, adds `needs-agent-review`, and upserts a single structured queue comment carrying the repo, PR number, head SHA, author class, and the resolved review config. It invokes no LLM. Its entire cost is the GitHub Actions minute floor: a label write, a comment write, done. No tokens are spent in the cloud, by design.

The label is the queue index. The comment is the audit trail and the metadata carrier. That's the trick that makes the whole thing durable: the queue lives in GitHub. When my worker is offline (traveling, home server rebooting, machine powered off) PRs just accumulate in the `needs-agent-review` state and wait. Nothing is lost, because there's no local queue to lose. When the machine comes back, the next tick reads GitHub's state and resumes. A powered-off worker just pauses the poll, and the events are still sitting in GitHub when it wakes up.

## The Worker (and Why the Scheduler Is Boring on Purpose)

The worker is a PowerShell script invoked by Windows Task Scheduler on the same home-server hardware that used to host OpenClaw. The mini-PC survived the rebuild. Only OpenClaw, the webhook bridge, and the tunnel hostname came off it.

One thing is easy to misread here, so I'll say it plainly: the headline is push → pull, and Task Scheduler is just the boring scheduler adapter sitting on top of that decision. The scheduler could be cron, systemd, or a cloud VM tomorrow without changing a single job spec. PowerShell + Task Scheduler is simply the lowest-friction option on a Windows box that's already on: no compile step, no runtime to deploy, sub-second per-tick boot. I deliberately wanted boring plumbing here.

The Task Scheduler entry starts at logon and startup, repeats on a 60-second interval, restarts on failure, and refuses to overlap runs. The claim protocol uses GitHub's own primitives as the atomic operations:

1. **List** every PR carrying `needs-agent-review` (one search call per tick, cheap at solo-dev volume).
2. **Claim** the oldest one by swapping the label `needs-agent-review` → `agent-review-in-progress` and recording `claimed_by` and `head_sha` in the queue comment.
3. **Run** the canonical `.claude/agents/review.md` agent locally under subscription-auth CLIs.
4. **Post** the verdict and swap to `agent-reviewed` (clean) or `changes-requested-by-agent` (findings).

If the worker crashes mid-review, a **stale-claim sweep** runs at the top of each tick and releases any `agent-review-in-progress` claim older than ~15 minutes back to the queue. If a new commit lands while a review is in flight, the head SHA in the comment no longer matches the claim, the now-stale verdict is discarded, and the next tick re-reviews against the new head. The marginal cost of that wasted run is operator-machine CPU only. The review runs under my existing subscription CLIs, so the LLM cost is $0.

The job spec itself is just data. Here's the relevant slice of the review job:

```powershell
# filepath: infrastructure/workers/grid-agent-runner/config/jobs/grid-review.psd1
@{
    JobId        = "grid-review"
    TriggerKind  = "label-queue"
    Schedule     = @{ Type = "interval"; IntervalSeconds = 60; AtStartup = $true; AtLogon = $true }
    PromptPath   = ".claude/agents/review.md"
    AgentCommands = @(
        @{ Name = "codex";  Executable = "codex";  PromptStdin = $true }
        @{ Name = "claude"; Executable = "claude"; PromptStdin = $true; RiskClasses = @("high"); Optional = $true }
    )
    WriteMode    = "comment-only"
}
```

The worker holds no secret-bearing inbound port. Its trust boundary collapsed to GitHub auth plus the local filesystem. There's no public ingress for review traffic to attack anymore, because there's no public ingress at all.

## What I Learned

The most useful thing this rebuild taught me: the discipline was right the whole time. The shape it rode on was the part that was broken.

Everything that made the reviewer good came through untouched: the context-loading contract, the review rubric, the advisory posture (a missing review never blocks a merge). All of that is a property of the agent prompt, and the prompt didn't change. The transport only ever carried diffs. So I got to rip out an entire failure-prone rail and the actual review behavior survived intact. When you can cleanly separate "what hurts" from "what works," a scary-sounding rebuild turns out to be a narrow one.

The second thing: inverting the transport let me delete infrastructure instead of adding it. OpenClaw, the webhook bridge, and the tunnel hostname all came off the home server (ADR-0088 finished that teardown). The HMAC webhook-signing secret got retired instead of perpetually rotated. The box itself stayed. The hardware was always fine. What was dead was the OpenClaw-centric way of organizing everything on top of it.

And a bonus I didn't fully plan for: once the runner stopped being a one-off review script and became a job framework with a scheduler adapter, every other scheduled agent job I'd been parking on OpenClaw came home to it too. `hive-sync`, the Lore sourcing and ingest passes, all of it. One substrate, one scheduler story, one recovery story.

## Next Steps

The worker runs two model families on every high-risk review: Codex CLI under one subscription, Claude Code CLI under another, synthesized into a single verdict. Why the Grid runs that many review layers (this runner plus CodeRabbit, Copilot, the Actions gates, and SonarQube) is a whole post on its own, and it's the next one I'm writing. This post was only ever about the transport.

The lesson I'm keeping: when an always-on inbound receiver keeps failing for a solo operator, a more reliable receiver is rarely the fix. Stop receiving. Reach out and pull instead, and let the queue live somewhere that's already always on.
