---
title: 'Building HoneyDrunk.Lore: My LLM Wiki and Daily News Blast'
description: 'How I turned the LLM wiki pattern into HoneyDrunk.Lore, a source-backed research surface that compiles raw sources into decisions, wiki pages, and a daily Discord signal review.'
pubDate: 'Jun 20 2026'
heroImage: '../../assets/llm-wiki.png'
category: 'Development'
tags: ['ai', 'automation', 'honeydrunk', 'llm', 'wiki']
---

I know I am late to the party talking about LLM wikis after Andrej Karpathy first put the pattern in public, but here is how I implemented it in my own flow.

The pattern clicked for me because it names a problem I had been living inside for a while. I read a lot. Model announcements, agent infrastructure posts, .NET and Azure updates, architecture writeups, indie software notes, game-dev tooling, security research, random high-signal threads that appear before the official writeup exists. All of it can matter to HoneyDrunk eventually, but almost none of it matters at the exact moment I read it.

That is the place where normal bookmarks fall apart. Bookmarks preserve the link and lose the understanding. Chat history preserves the conversation and loses the durable structure. RAG gives me retrievable chunks, then makes me rebuild the synthesis every time I ask a question.

The LLM wiki idea works at a different layer. Raw sources go in. An LLM reads them, extracts the useful claims, updates topic pages, links concepts together, tracks contradictions, and keeps a maintained markdown wiki between me and the source pile. The wiki becomes a compiled artifact. The model rediscovers context once, writes it down, and keeps it warm for the next query.

Karpathy's [LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), created on April 4, 2026, and the [X post that pointed people at it](https://x.com/karpathy/status/2039805659525644595) gave the pattern a crisp public shape. My implementation became HoneyDrunk.Lore.

## The Shape of Lore

HoneyDrunk.Lore is my compiled research knowledge surface for the studio. It is a flat-file wiki: markdown on disk, source-backed, Obsidian-friendly, versioned in git, and maintained by agents under an explicit schema.

The pipeline is intentionally boring:

```
raw sources
  -> compiled wiki
  -> AGENTS/schema
  -> query/output
  -> compile/lint
```

The `raw/` layer is the evidence locker. Articles, notes, clipped pages, selected social posts, and research outputs land there as immutable source material. Once something is in `raw/`, the rule is simple: add, do not rewrite history.

The `wiki/` layer is the compiled surface. It is where source material turns into concept pages, entity pages, topic indexes, confidence notes, and links. This is where claims get reinforced, weakened, superseded, or connected to other things I already know. The work that makes it more than a pile of summaries happens here.

The `AGENTS.md` file is the schema and operating manual. It tells the agent what the directories mean, what operations exist, how to treat citations, when to record gaps, how to handle contradictions, and what counts as a durable claim. This matters more than it sounds. Without the schema, an LLM wiki is just a helpful assistant making markdown. With the schema, it becomes a maintained knowledge system with rules.

Queries write back into `output/`. If I ask, "what does today's agent security signal imply for HoneyHub?" I want the answer filed as a dated artifact with citations, confidence, and gaps. Later compile passes can crystallize durable parts of that answer back into the wiki. The question becomes another source of learning instead of disappearing into a chat transcript.

Compile and lint are the maintenance loop. Compile ingests unprocessed sources, reconciles claims, updates indexes, and promotes durable query outputs. Lint looks for orphans, stale claims, contradictions, weak sourcing, and missing links. The payoff is the rhythm. The wiki has a standing process for staying healthy, so it keeps working long after the first burst of writing.

## The Daily Blast

The most recent work on Lore made the system feel less like a personal archive and more like an operator surface.

Every day, Lore can produce a news blast for Discord. It reviews the latest saved source window, pulls out the useful signal, and turns it into a compact daily briefing. The blast stays small on purpose: a decision-support summary for the parts of the world that matter to HoneyDrunk right now.

The shape is deliberately strict:

- Top 10 web stories.
- Top 10 X/Twitter posts.
- Actual source URLs and tweet URLs.
- Two or three sentence summaries.
- A HoneyDrunk angle for why each item matters.
- Discord messages split before they hit platform limits.
- No private internal tool names in the public-facing blast.

That last line matters. The public blast should say what happened, where it came from, and why it matters. It should not leak the names of whatever private worker, script, lane, or local process happened to collect the source. Public signal should be clean signal.

The X/Twitter lane is selective on purpose. I do not want Lore broadly crawling social media. That turns into noise immediately, and it makes the wiki depend on the most chaotic surface in the stack. But sometimes the useful signal really does appear there first: a primary-source launch post, a developer thread, an early warning, a discussion around a new agent pattern before the canonical blog post exists.

So Lore treats X/Twitter as an early-signal lane that has to earn its way into the durable record. Selected posts can be captured with the actual tweet URL, marked as early signal, and compiled like any other raw source. When a durable source appears later, an official blog post, docs page, changelog, model card, transcript, or technical writeup, that source should join or supersede the social capture. The tweet stays useful as first-report context, and it has to wait for corroboration before it carries any authority.

That distinction is the difference between "I saw a thing" and "the wiki knows a thing."

## Why I Wanted This

HoneyDrunk is not a single-product company in my head. It is a many-decade personal workshop: a computing platform, a studio, a lab, and a place to keep building strange useful things with AI agents over a long horizon.

That changes what research means.

I collect sources because they eventually affect decisions. Agent security patterns can shape how I build the agent tooling. Delivery and idempotency writeups can affect the messaging pipeline. Unity, asset pipeline, and game tooling posts can feed the game-dev work. Pricing, product, and solo-dev notes can change how I package the next experiment. A random model-routing benchmark might not matter today, then become exactly the missing context three months from now.

Lore gives that material somewhere to compound.

It is important to say what Lore is not. It is not HoneyDrunk governance. Governance lives in the architecture docs, ADRs, invariants, and repo contracts. Lore can inform a decision, but it does not make the decision official.

It is also not agent memory. Agent memory is runtime state, preferences, session history, and working context. Lore is source-backed decision support. If Lore says something, it should be able to point at the sources, report confidence, and name the gaps. I do not want uncited wiki prose becoming doctrine just because an agent wrote it once.

That boundary is the whole point. Lore is allowed to be useful because it is not allowed to be magic.

## The Part That Feels Different

The big unlock is that the wiki is a built artifact. It gets compiled, maintained, and carried forward the way code is.

Search asks, "can I find the thing again?" Lore asks, "has the thing been digested into the shape of what I already know?" Those are different questions. One retrieves. The other compounds.

The daily Discord blast made that visible. A source goes from a raw article or tweet into a reviewed daily signal. The signal keeps the original URL attached. The summary is short enough to read on a phone. The HoneyDrunk angle makes the relevance explicit. Later, if the item is durable, compile can fold it into the wiki. If it is weak, lint can let it decay. If a better source appears, the older claim can be superseded instead of silently overwritten.

That is the kind of system I want around a long-running workshop. Something that runs on its own rhythm, keeps what I have already learned, and stays warm between sessions.

A maintained wiki. A daily signal review. Source URLs attached. Confidence kept visible. Gaps named instead of hidden.

It is still rough in places, because every useful personal system starts rough. But it already changes the feel of reading. Sources do not just pass through my attention anymore. They have a place to land, a way to be compiled, and a chance to become part of the workshop's long memory without pretending to be governance or truth.

That is the version of the LLM wiki pattern I needed: a source-backed research surface for a studio I plan to keep building in for decades.
