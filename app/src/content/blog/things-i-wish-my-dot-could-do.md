---
title: 'Things I wish my Dot could do'
description: 'What I like about my Dot, where this week''s developer workflows broke down, and why even publishing this article became a Herculean task.'
pubDate: 'Oct 3 2026'
heroImage: '../../assets/things-i-wish-my-dot-could-do-cover.png'
category: 'Development'
tags: ['ai', 'programming', 'productivity', 'devjournal']
---

I've liked having my Dot around this week. I can send it a message when an idea comes to me, call it when talking is easier, and keep working from my phone while it gets on with a task. Even the little icons are a detail I enjoy.

OpenAI introduced Dots at [DevDay on September 29](https://openai.com/index/devday-2026-recap/). I've been using mine for a mix of things: working on a blog post, building PocketQuests, making prototypes, writing UI code, and organizing my learning schedule. Using it across all of that has given me a better sense of what I like about it and where I want it to go.

## What has worked well

The text-message style of interaction fits me. I can send an idea, add another thought, and keep the conversation going. Being able to call my Dot is a major plus. Sometimes talking through what I want is much easier than trying to type the whole thing out.

My ideas don't arrive in an orderly queue. I can be thinking about a project, a prototype, a blog post, and something I want to learn almost at the same time. Having somewhere to put that stream of ideas, get it organized, and turn it into projects, coding sessions, or time on my schedule has been useful.

I also like that my Dot has its own computer in the cloud. My computer doesn't have to be on for everything. When the work does need my computer, I can still keep the conversation going from my phone. I can kick things off during the day and get a message when it needs something from me.

Other assistants have been doing versions of this. It's still one of the things I like about this product, because it fits how I want to work.

So far, I also haven't had the constant Telegram or computer-connection debugging I've associated with OpenClaw, especially around updates. That's been a welcome difference in my own experience. I want to spend time using the assistant rather than maintaining the setup around it.

The gaps have become clearer as I've tried to do more through that same conversation.

## More control of my computer

One of the things I want to do is start an app or game task from my phone and have my Dot work through it on my computer. That includes opening the application, moving through its screens, or walking through a game while I watch.

This week, we could launch coding tasks on my Windows computer and run commands. That didn't give the launched session the keyboard and mouse controls it needed for the interactive parts.

We ran into that distinction while trying to work with Unity. Starting a task and opening a command window got us only partway to actually interacting with the game. I ended up sorting out permissions myself, and the behavior differed depending on how the tools were launched.

I'd like the Dot-to-computer connection to make those capabilities clearer. Can this session run commands? Can it see the application? Can it click and type? What does it need from me before it can continue?

I'm describing the setup we encountered, rather than claiming this can never work on Windows. But for the way I want to use my Dot, working through an application on my computer is a pretty important part of the job.

## Keep working with Claude after starting it

There was another distinction in our coding workflow. My Dot could start a Codex session and continue working with it. We could also launch Claude with an initial prompt, but we didn't establish a reliable way to send follow-up instructions into that same Claude session.

That's a limitation I'd really like to see addressed.

Right now, I pay $200 a month for OpenAI and $200 a month for Anthropic. I use them for different things because I think both bring value. I'd prefer those tools to work together more easily.

The workflow I want is straightforward: talk to my Dot, choose Codex or Claude for the work, and keep directing that work through the same conversation. Starting the session is useful. Being able to follow up, answer a question, or change direction is what would let me keep using it from my phone.

Voice is especially relevant here. The place I most want voice is in my coding workflow, where I can explain what I want and respond as the work develops. A voice conversation that can keep the chosen coding session moving would be much more useful to me than having to switch interfaces whenever it needs another instruction.

## Give me a result I can use on my phone

We ran into this while working on the PocketQuests prototype. I wanted a live link so I could open it on my phone and try the interface.

The first preview didn't work. We then tried putting it into a Space, but that didn't give me a usable interactive experience either. Eventually, we published it as a private Site, and that worked.

Somewhere in that process, I was offered a ZIP file.

I was on my phone. What am I supposed to do with a ZIP?

The files existed, but they weren't in a form I could use for what I'd asked to do. I wanted to try the prototype, and I was still helping figure out how to get it in front of me.

I'd like my Dot to account for the device I'm using when it delivers something. If I'm on my phone asking to review an interactive interface, a working link is the useful result. If it isn't sure what I can open, it can ask.

What I want is less involvement in finding the delivery workaround. Building the prototype, making it available, and checking that I can use it should be part of the same request. In this case, we eventually found a working route. I'd like fewer of those steps to depend on me suggesting what to try next.

## Publishing this article became another example

Even publishing this article to three different sites turned into a Herculean task. Last week, my Dot handled the same workflow in one shot. This time, I kept getting pulled back in to troubleshoot it.

I wanted the post on my own site, DEV, and Medium. We had already made the article and its cover in the cloud. Then the publishing attempt ran into a GitHub connection that couldn't write to my personal blog repository.

My laptop already had working GitHub access. I had to ask why we weren't just using Codex on that computer. When we checked, the local Git account was correct and could access the repository. The next failure was getting the approved files onto that machine: the file-transfer helper failed on Windows while trying to save file metadata.

Those were separate problems. One connection lacked access to the repository. A different part of the workflow couldn't finish transferring the files. My local Git setup was working.

The assistant also made the experience worse. It kept switching between approaches and asking me to move files, instead of checking a complete route from the draft to the published pages before committing to it. I expected the Codex workflow to handle that work. I ended up telling it to start over locally and add the experience to the article.

That inconsistency is the frustrating part. After a workflow has worked in one shot, I expect to be able to ask for it again. If the available tools or connections are different this time, I want my Dot to find that out early, explain the actual limitation, and carry on through a route it has checked.

Writing the article, creating the cover, moving the files, and publishing the result all belonged to the same request. I don't want to become the person coordinating the handoffs between my assistant's computers.

## Show me more of the developer workflow

OpenAI has already published examples of [working with Codex from a phone](https://openai.com/index/work-with-codex-from-anywhere/). The [Dots page](https://chatgpt.com/features/dots/) also shows developer work, including API migrations and app improvements. Those are useful examples.

What I'd like to see in more detail is the Dot coordinating a longer development session. How do OpenAI's own developers kick off several coding agents, follow up with them, and move between their phones and computers while building software?

I'd find a walkthrough of that whole process useful, including what happens when an agent needs another instruction or a preview doesn't open. If there's already a good Dot-specific demonstration of that workflow, send me a link. That's the part I'm trying to make work consistently in my own development day.

## Where does this go next

Beyond the things I've run into this week, I'm interested in how personal assistants develop from here.

[OpenAI's current guidance](https://help.openai.com/en/articles/20001530-getting-started-with-your-dot) says the first Dot is included in eligible plans, with an allowance for deeper work and extended limits for the first month after launch. I'm curious how usage and subscriptions will evolve from there.

How much control will we have over the models our Dots use? If people have teams of Dots, how will those work together?

The larger question for me is whether I'll need several personal assistants. Each company may develop its own approach, and I can imagine having reasons to use more than one, just as I already use more than one coding tool.

But I'd rather have a primary assistant that can coordinate the tools and other assistants I choose. Maybe it starts additional assistants when they're useful. Maybe it hands a task to a different provider and stays involved while that work happens.

I'm interested in seeing whether these products move toward that kind of cooperation or whether using several of them will mean maintaining several separate conversations. I already get different value from different providers. I'd like my personal assistant to help me make use of that.
