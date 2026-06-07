---
title: 'Four Reviewers and a Gauntlet: Verifying AI-Authored Code'
description: 'Almost all of my code is written by AI now, so my job moved to verification. Here is the layered review every pull request runs before it can merge, and why defense in depth is the right shape for a solo AI-heavy shop.'
pubDate: 'Jun 07 2026'
heroImage: '../../assets/prs.png'
category: 'Development'
tags: ['architecture', 'automation', 'devops', 'honeydrunk', 'tooling']
---

Almost none of the code I ship was typed by me. I describe what I want, an AI coding agent writes the implementation, and I read what comes back. That one fact, still strange to say out loud, has quietly reorganized my entire job. I run a studio's worth of services solo, and across all of those repos the bulk of the actual authoring now happens on the other side of a prompt.

That changes the job. When you're the one writing every line, your judgment lives in the writing. You feel the design as you type it. When an AI writes the lines, that feeling is gone, and you can fool yourself into thinking the work is done the moment the code looks plausible. Plausible is exactly the failure mode. AI-authored code is usually fluent, often correct, and occasionally confidently wrong in a way that reads great and breaks in production.

So my judgment had to move somewhere. It moved to the verification layer. These days my attention goes to one thing: making sure what lands is solid. Every pull request in my repos runs a gauntlet of layered review before it's allowed to merge. This post is about that gauntlet, why it has so many layers, and why the economics of it actually favor a one-person shop.

---

## What "AI Writes the Code" Means Here

Quick grounding before the jargon, because this is a public post and the setup is specific.

I'm a solo founder building HoneyDrunk Studios. The bulk of the code authoring is done by AI coding agents (think command-line tools that take a task and produce a diff). My leverage is in two places now: specifying intent clearly enough that the agent builds the right thing, and verifying the output well enough that I trust it in production. The first half is prompts and design notes. The second half is the review gauntlet.

A couple of terms I'll use repeatedly:

- A **CI gate** is an automated check that runs on every pull request and has to pass before the code can merge. Build the project, run the tests, check formatting, measure test coverage. If any required gate fails, the merge button stays off. CI stands for continuous integration; for my purposes it's just "the robot that won't let bad code in."
- A **pull request** (PR) is the unit of change. One proposed diff, opened for review, merged when it passes. Every layer below operates on a PR.

With that established, here are the layers.

---

## The Layers

Every PR I open can face up to five distinct reviewers before it merges. Each one is good at something different, and the overlap is the point.

**1. CodeRabbit.** An AI service that reviews pull requests. It reads the diff, comments inline on specific lines, flags likely bugs and convention violations, and summarizes the change. I deploy it across all my repos from one org-level configuration rather than copying a config file into every repo by hand. One file governs the whole studio, which matters when "the whole studio" is dozens of repos and one person maintaining them.

**2. GitHub Copilot review.** GitHub's own built-in AI reviewer. It runs inside the GitHub PR interface and posts its own read of the diff. It's a second AI opinion from a different vendor with a different training and a different rubric, sitting right where I'm already looking.

**3. My own local AI review runner.** This is the one I built. It runs an AI code review on my own hardware, under my existing CLI subscriptions, and posts its verdict as a PR comment. On high-risk changes it runs the review through two different model families, Codex and Claude, and synthesizes their findings into one verdict. Two independent models, two independent blind spots. I wrote a whole separate post on how this runner's transport works (it polls GitHub and treats labels as a durable queue rather than waiting for a webhook); if you want the plumbing, read [Stop Receiving Webhooks, Start Polling](/blog/pull-based-grid-review-runner/). Here it's just one layer in the stack.

**4. GitHub Actions CI gates.** The automated required checks. Build succeeds, tests pass, coverage holds, formatting is clean, code quality thresholds are met. These are pass/fail facts rather than opinions, and a failing one blocks the merge outright. Where the AI reviewers say "this looks risky," the gates say "this is broken, full stop."

**5. SonarQube.** A static-analysis tool that scans the code without running it, hunting for bugs, code smells, security-sensitive patterns, and coverage gaps, then gates the PR on a quality threshold. It's the deterministic, rules-based counterweight to the four probabilistic AI opinions above it. SonarQube finds the same kind of issue the same way every single time, which is exactly what you want sitting next to a stack of models that each answer a little differently on every run.

Five layers, three flavors: AI reviewers reading intent (CodeRabbit, Copilot, my runner), hard pass/fail gates (Actions), and deterministic static analysis (SonarQube). A change has to satisfy all of the ones that apply to it before it merges.

---

## Risk-Based Escalation, and Why This Is Affordable

A reasonable reaction here is that five reviewers on every pull request sounds slow and expensive. It would be, if every layer ran at full weight on every change. They don't.

The stack is risk-scored. Each change gets a rough risk assessment, and the most expensive layers escalate only for the riskiest changes. A one-line copy fix in a README doesn't earn a dual-model deep review. A change to authentication, a database migration, or a deploy pipeline does. The heavyweight pass, my local runner spending the time to run both Codex and Claude and reconcile them, kicks in where the cost of a missed bug is highest. That's a deliberate cost-and-coverage tradeoff: spend the expensive attention where a mistake actually hurts, and let the cheap layers carry the routine changes.

The economics work out in favor of layering, and that surprised me. Here's the shape of it for a solo dev:

- CodeRabbit and Copilot review run on flat-rate subscriptions. Their cost is the same whether they review one PR a week or thirty.
- The GitHub Actions gates run on CI minutes that, at my volume, sit comfortably inside the free allowance.
- My local runner executes under CLI subscriptions I already pay for, on hardware I already own and leave running. Each review it performs adds no marginal token bill.
- The risk scoring caps how often the genuinely expensive path runs at all.

Put those together and adding another reviewer to the gauntlet is mostly free at the margin. The fixed costs are paid; the per-PR cost of one more layer rounds to nothing. For a single operator, that's a rare situation where the safe choice and the cheap choice are the same choice. I'll take more independent eyes when more eyes are close to free.

---

## Why So Many: The Thesis

The reason for all of this fits in one observation about probability.

A bug that one reviewer misses is common. Every reviewer, human or AI, has blind spots. A bug that two independent reviewers both miss is less common, because their blind spots rarely line up. A bug that survives an AI reviewer, a second AI reviewer from a different vendor, a dual-model local review, a battery of pass/fail gates, and a deterministic static analyzer is rare, because for that to happen, every one of those different rubrics has to fail in the same place at the same time. That's defense in depth: stack independent checks so that no single failure gets the whole way through.

This is exactly why the high-risk path runs two different model families instead of running one model twice. Two passes of the same model share the same blind spots; they tend to agree, including when they're both wrong. Two different models disagree productively. One flags something the other waved through. The disagreement is the value. So the principle I hold is that the riskiest changes always get two genuinely independent model perspectives, two different rubrics from two different vendors looking at the same diff.

And the human is still in this, just not where I used to be. I'm not reading every line as it's written anymore. I'm reading verdicts, resolving the cases where the layers disagree, and deciding what's actually true when CodeRabbit loves a change and SonarQube hates it. The judgment is still mine. It moved from the keyboard to the merge button.

I want to be honest that this is an opinionated setup built for one specific situation: a solo dev whose code is overwhelmingly AI-authored. A team with humans writing and reviewing code line by line already has a lot of this coverage built into how they work, and stacking five automated layers on top might be redundant for them. For me, where no human wrote the code in the first place, the verification layer is the only place human judgment touches the work at all. So it gets all of it.

---

## The Close

When you stop writing the code, you don't stop being the engineer. The engineering just moves downstream, from authoring to specifying and verifying. The gauntlet is where I spend my judgment now, and I built it deep on purpose.

Let the cheap, fast layers catch the routine misses. Let two different models argue over the dangerous changes. Let the deterministic gates have the final, unarguable say. Write less code, verify it harder. That's the job now.
