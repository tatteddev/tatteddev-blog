---
title: 'Why I''m Pointing at Game Dev in 2027'
description: 'Calling my own shot in public: why a backend and platform engineer who builds systems for a living is aiming his 2027 at making games, and what he has to learn to get there.'
pubDate: 'Jul 04 2026'
heroImage: '../../assets/2027-gaming.png'
category: 'Projects'
tags: ['personal', 'indie-dev', 'game-dev', 'unity', 'blender']
---
In the very first post on this blog, back in September 2025, I said I was the kind of person who would write a backend service one day and model a 3D world in Blender the next. I meant it. I have written a lot of backends since then. The Blender file is still empty.

So this post is me calling my own shot. In 2027 I am going to make games. Not "someday." Not "when things calm down." A specific year, written down in public where I can be held to it.

I want to be honest about what this post is and is not, because I have read enough breathless "I'm becoming a game developer" threads to know the shape of the lie. This is not a launch. There is no game. The tools are locked in, Unity for the engine and Blender for the art, but there is no genre picked and no clever mechanic I am sitting on. If you came for a trailer, I have nothing for you yet. What I have is a direction and a reason, and I have learned that saying the direction out loud is the part that makes it real.

---

## Why Now, and Why Not Yet

I run a small software studio by myself, on top of roughly fifty hours a week at my day job, which is also software. Most of the hours I can spare go to the unglamorous plumbing that makes software work: services that talk to each other, data that has to survive a deploy, automation that watches the whole thing so I do not have to. I like that work. I am good at it. It is also, if I am being real with myself, the most comfortable possible place for me to hide.

Games are the thing I keep circling and never landing on. Every time I write about my week, some game-dev tangent sneaks in: a tool I read about, an engine release, a devlog that made me jealous. The interest has been sitting there the whole time, load-bearing but unbuilt, like a wire I keep meaning to connect.

The reason for 2027 instead of right now comes down to groundwork. There are two things on my 2026 plate that I want to see through before I split my attention, and both of them, weirdly, are runway for the games. More on that below. Pointing at 2027 gives me a real year to close those out and to start learning the parts of game development that my day job has taught me nothing about. Naming the date is the commitment. The gap before it is the training.

---

## What a Backend Brain Actually Brings

Here is the part I have to be careful with, because it is where the delusion lives. A lot of engineers assume that being senior in one kind of software makes them senior in games. It does not. Games are their own discipline, with their own hard-won craft, and plenty of brilliant backend engineers have bounced off them hard.

But some of what I do every day does transfer, and it is worth being clear-eyed about which parts.

I build systems for a living. State that has to stay consistent, components that have to talk without knowing too much about each other, code organized so that a change in one place does not detonate three others. A game is, under the pretty surface, a very demanding real-time system: an update loop running dozens of times a second, entities with state, systems that read and mutate that state in a strict order. The architecture instincts I have sharpened on distributed services are not wasted here. They are just pointed at a different clock.

My tools overlap more than I expected, too. My studio is built mostly in C# and Rust, and Unity scripts in C#. So the leap is not from a standing start. I am not learning a new language and a new craft and a new mental model all at once. I get to keep the language and spend all my learning budget on the craft.

And the honest flip side: none of that helps me with the parts that actually make a game good. Systems thinking will not teach me to make a jump feel satisfying. Clean architecture will not tell me why one level is fun and the next is a slog. That stuff is a different muscle entirely, and I have barely used it.

---

## What I Actually Have to Learn

So let me name the gaps plainly, because a commitment post that pretends there are none is worthless.

- **Unity, end to end.** Not a weekend tutorial. Actually shipping something small all the way through: scene, input, state, build, the boring bits at the end that nobody blogs about.
- **Graphics, at least enough to not be helpless.** I do not need to write a renderer. I do need to understand what a shader is, why a frame costs what it costs, and how to fix it when the scene chugs. Right now that is close to a black box for me.
- **Game feel.** The invisible craft. Timing, feedback, weight, the difference between a control scheme that reads your mind and one that fights you. This is the one that scares me, because you cannot architect your way into it. You have to build a hundred bad versions and develop taste.
- **Scope.** The graveyard of solo game dev is paved with projects that were too big. I already fight this instinct in my studio work. In games it kills you faster.
- **Art, or a strategy for not doing art.** I have a great deal of respect for art, and I wish I were naturally good at it. I am not, and right now I simply do not have the time to change that. I am enrolled in [ART School by Marc Brunet](https://cubebrush.co/mb/products/0dpzeg/art-school), and both the course and Marc as an instructor are excellent. Nobody is paying me to say that, I just believe it is that good, and I plan to work through it as time allows. Until the hours exist, my plan has two lanes. Lane one is buying assets: the marketplaces are full of good, affordable work made by people who did put in those years, and a solo dev who refuses purchased art is choosing pride over shipping. Lane two is the one that actually excites me. Blender shipped an official MCP server this year, a small bridge that lets an AI assistant talk to Blender's Python scripting directly, and directing AI assistants through exactly that kind of bridge is already how I spend my days. Anthropic even joined the Blender Development Fund, so this lane is being paved on purpose. Which means "model a 3D world in Blender" might end up looking a lot like the rest of my work: I describe what I want, Claude does the first pass in the viewport, and I learn enough Blender to judge the result and fix what is wrong with it.

None of these are unknowable. All of them take reps I have not put in.

---

## How 2026 Is Quietly Building the Runway

This is the part that convinced me the timing is right rather than arbitrary.

The first thing eating my 2026 is that I build with AI coding agents all day. I do not write most of my code by hand anymore. I direct a couple of coding assistants, review what they produce, and steer. I have been building my own control panel to run them, a local cockpit I call HoneyHub. It is transforming into a full-blown IDE with everything I love and need to do my work, and there will be more posts on that soon. The whole way I work now is agent-first. That matters for games in a blunt way: the thing that historically stopped a solo backend dev from making a game was raw hours. One person cannot do engine work and gameplay and tooling and art pipeline in a normal lifetime. That math has changed. The bottleneck is shifting from "can I type all of this" to "do I have the taste to know what to build and the judgment to know when it is right." Taste and judgment are exactly what I would be spending 2027 developing.

The second thing is NovOutbox, the first product my studio is taking to market. It is a hosted notification service built specifically for .NET developers: your app hands it a message, and it handles the queueing, the retries, and the delivery so you do not have to build that plumbing yourself. It sounds boring because it is, in the way good infrastructure is boring. What makes it matter for this post is its planned first customer: me. The app I want to build on top of it is codenamed Arc, a gamified self-improvement app that is still an idea being stress-tested rather than a thing being built. I have always loved gamified apps, the ones that borrow their shapes from games: seasons, progression, a little story wrapped around real effort. And that love is quietly another pathway to the same destination. A gamified app is a halfway step between the software I already know how to build and the games I want to make. It forces me to learn reward pacing, feedback, and why a loop feels good or hollow, and it lets me practice all of that without an engine in sight. If the idea survives its stress test, Arc probably gets built in 2027 too, right alongside the first game. That crowding does not scare me. They pull on the same new muscles, and I would rather train them together than in sequence.

I did not plan it this way. I looked up one day and realized the runway had been building itself while I was busy pointing at other things.

---

## The Plan, Such As It Is

I am deliberately not over-specifying this, because a rigid plan a year out is a fantasy. But the shape is:

- Finish what 2026 is for. NovOutbox in front of real users and HoneyHub grown into the IDE I want to live in. Those two get the rest of my year, and nothing else does.
- Go deep on Unity. The engine is picked and I am not window shopping. It speaks the C# I write every day and the learning material is bottomless. Engine-shopping is just procrastination with a progress bar, so I skipped it.
- Put real hours into Blender. The goal is comfort in the viewport rather than artistry. Blockouts, simple props, and enough fluency that when an agent hands me a scene over MCP I can tell whether it is good, fix it when it is close, and redo it myself when it is garbage.
- Ship something embarrassingly small. A single mechanic. One screen. The game-dev equivalent of "hello world," finished and actually done, before I let myself dream bigger.
- Build taste in public. Devlogs here, honestly, including the ugly early builds.

That last one is the real point of writing this now. I have a documented history of letting game dev stay a "someday" while I retreat into the systems work I already know how to do. Putting a year on it, in public, is how I make it cost something to chicken out.

The Blender file is still empty. The Unity project does not exist yet. Consider this post the title screen. New game starts in 2027.
