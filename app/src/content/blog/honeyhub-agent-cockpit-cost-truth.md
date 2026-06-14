---
title: 'Two Terminals, One Screen: Building an Agent Cockpit That Tells the Truth About Cost'
description: 'How I unified the Claude Code and Codex CLIs behind one local cockpit, and why the spend view refuses to fabricate a dollar figure it cannot measure.'
pubDate: 'Jun 14 2026'
heroImage: '../../assets/agents.png'
category: 'Projects'
tags: ['rust', 'tooling', 'honeydrunk', 'indie-dev', 'ai']
---

The setup that pushed me to build this was embarrassingly low-tech. Two terminal windows, side by side. One running the Claude Code CLI on a refactor. One running Codex on a different repo. Two live coding agents, two different repos, two different ways of telling me what just happened.

Each window has its own dialect for reporting a turn. Claude prints a tidy result line with tokens and a dollar figure. Codex streams whole messages and reports tokens but no money. So at any given moment I had a pair of agents running and no single place that could answer the one question I actually cared about: how much have I spent today, and on what.

I kept Alt-Tabbing between windows trying to add that up in my head. That is a stupid way to run a studio. So I built a cockpit.

This post is about that cockpit, which I call HoneyHub, and specifically about the part that was much harder than the windowing: making a single cost view that pulls from two tools which measure cost in completely different units, without lying to me about either of them.

---

## What HoneyHub Is

HoneyHub is a local control panel for AI coding agents. It runs on my own machine, serves a small web app I open in a browser (phone or desktop), and drives the official command-line tools I already pay for: the Claude Code CLI and the Codex CLI. Nothing gets proxied through a server I rent. Nothing holds my subscription credentials. HoneyHub shells out to the same binaries I was running by hand, reads their output, and shows it on one screen.

The core is a Rust crate (`bridge`) that owns the child processes, and a TypeScript web app that renders the sessions. Between them is a contract: every backend, no matter how differently its CLI behaves, gets adapted into the same stream of events. A message event. A status event. A usage event. The web app never has to know which tool produced a given line.

That contract is the whole trick, and the usage event is where it earns its keep.

---

## The Problem: Two Tools, Two Definitions of "Cost"

Before I wrote a line of the cost view, I ran each CLI and read exactly what it hands back when a turn finishes. The two could not report cost more differently.

**Claude Code** is the generous one. When a turn completes, it emits a `result` line carrying exact input and output token counts and a real dollar figure (`total_cost_usd`) computed on its side. I don't have to guess anything. I take the number it gives me.

**Codex** reports exact token counts but no money at all. It tells me a turn used 1,000 input tokens and 1,000 output tokens, and then it stops. If I want a dollar figure, I have to multiply those tokens by a rate I supply myself. The tokens are ground truth. The dollars are something I compute, and only if I've configured a rate.

So even with just these two, I had two genuinely different kinds of number staring at me:

- A measured dollar figure that a vendor computed (Claude).
- A dollar figure I derive from exact tokens and a rate I supply (Codex).

Those are not the same thing, and pretending they are is how a dashboard starts lying to you. The lazy move is to mash both into one "total spend" number and call it a day. I refused to, because the moment a derived estimate and a measured figure get added together you can no longer tell which dollars are real. The whole reason I wanted a cockpit was to *trust* the readout. A blurred total is worse than no total.

So the design rule became: the system has to know, for every cost figure it shows, how that figure came to exist. And it has to refuse to blend a measurement with a guess.

---

## The Solution: Fidelity Is a First-Class Field

Inside the bridge, every usage report carries a `fidelity` tag. There are exactly three values, ranked from most trustworthy to least, and the order matters:

```rust
// filepath: crates/bridge/src/session.rs
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UsageFidelity {
    Exact,
    Derived,
    Estimated,
}
```

`Exact` means the CLI handed me the dollars directly. `Derived` means I computed dollars from exact tokens and a rate table. `Estimated` means the numbers are a proxy and should never be read as money. Today's two backends use only the first two tiers: Claude reports `Exact`, Codex reports `Derived`. `Estimated` is built in and waiting for the kind of backend that can only guess at what it spent, a tool whose CLI hands back neither a dollar figure nor a real token count. I have no such backend wired in right now, but the tier exists so that when one shows up, its guesses can never quietly pass as measurements. Every adapter is required to tag its usage signal honestly, and each one does it differently because each tool is different.

### Claude: take the number, don't touch it

The Claude adapter reads the `result` line and copies the dollar figure straight through. No arithmetic. The only cleverness here is folding cache-read and cache-creation tokens into the total so an "exact" signal never under-reports:

```rust
// filepath: crates/bridge/src/adapters/claude_local.rs
UsageSignal {
    backend: AgentBackend::ClaudeLocal,
    // Claude Code reports exact tokens + USD; taken directly, no computation.
    // USD is never derived from a rate table for this backend.
    fidelity: UsageFidelity::Exact,
    input_tokens,
    output_tokens,
    total_tokens,
    total_usd: value.get("total_cost_usd").and_then(Value::as_f64),
    confidence: Some(UsageConfidence::High),
    // ...
}
```

### Codex: exact tokens, dollars only if I asked for them

The Codex adapter has the exact tokens but has to derive the dollars. The rate lookup is *injected* into the adapter rather than hardcoded, so the bridge crate never bakes a vendor's prices into itself. And here is the part I care about most: if no rate is configured, the tokens stay exact and the dollar figure is simply absent. It is never fabricated.

```rust
// filepath: crates/bridge/src/adapters/codex_local.rs
// Tokens are exact; USD is derived from the injected rate table.
// With no rate configured the cost is absent — never fabricated.
let total_usd = match (model, input_tokens, output_tokens) {
    (Some(model), Some(input), Some(output)) => (rate)(model, input, output),
    _ => None,
};
```

The default rate lookup wired in when nothing is configured returns `None` for everything, on purpose:

```rust
// filepath: crates/bridge/src/adapters/codex_local.rs
/// The default lookup: no rate table wired, so USD is always absent (tokens exact).
pub fn no_rate_lookup() -> UsdRateLookup {
    Arc::new(|_model, _input, _output| None)
}
```

So out of the box, Codex shows you exact tokens and an honest blank where the dollars would be. You opt into derived dollars by handing it a rate. That ordering is the whole point. When the system has no grounds for a number, it says "I don't know" and leaves the space empty. It never fills that space with a guess.

---

## The Centerpiece: The Two-Way Usage Table

Here is the whole problem on one page. Same question, two tools, and what each one can actually tell you:

| Backend | Tokens | Dollars | Real billing unit | Fidelity tag | Shown as |
|---|---|---|---|---|---|
| Claude Code | exact | exact (`total_cost_usd`) | dollars | `exact` | `$0.0123` |
| Codex | exact | derived from a rate, or absent | tokens | `derived` | `≈$0.0030` |

The "shown as" column is not cosmetic. The display layer formats every figure with a prefix that encodes its fidelity, so an estimate can never visually pass as a measurement:

```typescript
// filepath: packages/ui/src/usageFormat.ts
export function usdPrefix(fidelity: UsageFidelity | undefined): string {
  if (fidelity === "estimated") return "~$";
  if (fidelity === "derived") return "≈$";
  return "$";
}
```

A plain `$` is a number a vendor measured. A `≈$` is a number I computed from a rate. A `~$` is a soft guess. You can tell at a glance which is which without reading a legend. And when a rollup has no dollar figure to show at all, the cell renders an em dash rather than a fabricated zero:

```typescript
// filepath: packages/ui/src/routes/spend/spendModel.ts
export function rollupCost(rollup: UsageRollup): string {
  if (rollup.totalUsd !== undefined) {
    return formatUsd(rollup.totalUsd, rollup.fidelity);
  }
  return "—";
}
```

---

## The Headline Number Sums Only What It Can Measure

The cockpit shows one big number at the top: today's spend. The temptation, the entire reason this was hard, is to make that number include everything. It doesn't. The grounded total sums only the dollar figures that are real, which is to say `exact` and `derived`. Anything tagged `estimated` is excluded by construction, so the day a guessing backend gets wired in it still cannot touch the headline:

```typescript
// filepath: packages/ui/src/routes/spend/spendModel.ts
const grounded = rollups.filter(
  (rollup) => rollup.fidelity === "exact" || rollup.fidelity === "derived"
);
const anyGroundedUsd = grounded.some((rollup) => rollup.totalUsd !== undefined);
const groundedTotalUsd = anyGroundedUsd
  ? grounded.reduce((sum, rollup) => sum + (rollup.totalUsd ?? 0), 0)
  : undefined;
```

When nothing grounded has been recorded yet, the headline is `undefined`, not `$0.00`. That distinction is deliberate. There is a real difference between "you have spent zero dollars" and "I have no measured spend to report," and a tool that collapses the second into the first is lying to you about a number you might make decisions on. So the view says "no measured spend yet" rather than inventing a confident zero.

The Rust side enforces the same rule, with a comment that is basically the thesis of the whole feature:

```rust
// filepath: crates/bridge/src/session.rs
/// Sum of USD across **exact + derived** rollups only — a real dollar figure.
/// Estimated rollups are excluded so a guess can never inflate the headline
/// spend. `None` when no grounded signal reported USD.
```

Two implementations, one in Rust on the host and one in TypeScript for the offline mock, and they agree on the rollup shape down to the ordering. That redundancy is on purpose too: the formatting honesty lives in tested code on both sides of the wire, so neither can quietly drift into showing an estimate as a fact.

---

## What I Learned

The engineering lesson here is smaller than it looks and more useful than I expected: **fidelity is data, not presentation.** My first instinct was to compute one blended dollar total and then sprinkle a "(estimated)" label on the UI somewhere. That fails the moment anything reads the number, because by then the measurement and the guess are already added together and you can't pull them back apart. Tagging every single usage signal at the source, the instant it leaves the adapter, is what makes the honest rollup even possible downstream. The guess and the measurement never touch.

The product lesson is the one I keep coming back to. I built this so I would trust the readout, and a tool you can't trust is worse than the two terminal windows I started with, because at least the windows weren't pretending. A dashboard that confidently sums a measurement and a wild guess into one number trains you to distrust it, and then you go back to adding it up in your head anyway. The blank where Codex's dollars would be, and the "no measured spend yet" instead of a fake zero, are the features. They are the reason I look at the number and believe it.

---

## Next Steps

The cost view is one panel. The cockpit also surfaces live sessions, per-session diagnostics, and cross-session coaching, and the same fidelity discipline runs through all of it: a capability either exists for a backend or it doesn't, and the UI declares which honestly rather than faking a uniform experience. Codex can't do a live mid-turn reply, so the cockpit doesn't pretend it can; it routes the follow-up through a fresh resumed run instead. That honesty-by-construction posture is the through-line of the whole thing.

What's left is the part no amount of code can do for me: running it for a real day of work and seeing whether the number at the top actually changes how I spend. That's the test that matters.

If a tool is going to tell you what something cost, it owes you the truth about how sure it is. A blank is more honest than a guess wearing a dollar sign.
