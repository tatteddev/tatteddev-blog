---
title: 'Building the HoneyDrunk Way'
description: 'How I avoided the "Common library" trap and built a package ecosystem that actually scales without becoming a junk drawer.'
pubDate: 'Oct 01 2025'
heroImage: '../../assets/abstractions.png'
category: 'Development'
tags: ['software-architecture', 'packages', 'abstractions', 'scaling', 'honeydrunk']
---

When you're building something big, it's easy to fall into the "just toss it into Common" trap. You know the one — a giant "Shared" library where every random helper, DTO, and extension method ends up living rent-free. That's fine until you wake up one day and realize you've created a god-class library that nobody understands and everybody hates.

I didn't want that. HoneyDrunk (my indie dev playground) is meant to scale cleanly, so I sat down and mapped out what the shared package ecosystem should actually look like. This post is me brain-dumping how I'm structuring it, so future-me doesn't scream at past-me later.

## Core First, Junk Drawer Never

The heart of the platform starts with fundamentals:

**HoneyDrunk.Core** handles base entities, domain events, and common exceptions. **HoneyDrunk.Validation** manages validators and rule sets. For security, **HoneyDrunk.Security** covers hashing with Argon2, JWT utilities, and auth helpers. 

**HoneyDrunk.Caching** provides Redis and memory abstractions, while **HoneyDrunk.Configuration** integrates with Key Vault for strongly typed configs. And **HoneyDrunk.FeatureFlags** lets me toggle features like a boss.

These are primitives, not business logic. They're the Lego bricks everything else is built on.

## Data + Networking

When it comes to persistence and APIs, **HoneyDrunk.Data** handles EF Core patterns, DbContext helpers, and migrations. **HoneyDrunk.Storage** abstracts away whether I'm using Blob storage, S3, or local filesystem.

For HTTP calls, **HoneyDrunk.Http** gives me a resilient HttpClient factory with retry and jitter built in. **HoneyDrunk.RestService** wraps that when I want less boilerplate. **HoneyDrunk.Grpc** manages shared contracts and helpers, while **HoneyDrunk.SignalR** handles hub contracts and client utilities.

## Messaging vs Notifications

Here's where people mess it up. Messaging ≠ Notifications.

**HoneyDrunk.Messaging** is system-to-system stuff: pub/sub events, service bus commands. But notifications? That's a different beast entirely. **HoneyDrunk.Notifications.Email** handles user-facing emails, **HoneyDrunk.Notifications.Sms** manages text messages, and **HoneyDrunk.Notifications.Push** covers mobile and web push notifications.

One is about services talking to each other, the other is about talking to humans. Don't cross the streams.

## Observability + Quality

If you're not measuring, you're guessing.

**HoneyDrunk.Observability** brings together Serilog, OpenTelemetry, metrics, and tracing so I actually know what's happening in production. **HoneyDrunk.Testing** gives me Moq setups, Cypress helpers, fixtures, and all the test utilities I need to not ship broken code.

## Commerce (Not Just Payments)

I almost made a HoneyDrunk.Payments package. Glad I stopped. Payments are just one part of a bigger story.

Instead, I split it into **HoneyDrunk.Commerce.Orders**, **HoneyDrunk.Commerce.Payments**, and **HoneyDrunk.Commerce.Billing**. That way I can handle orders, invoices, and subscriptions without bending a "Payments" package into something it was never meant to be. Abstraction matters.

## Integrations

These are where the fun APIs live.

**HoneyDrunk.Integrations.Streaming** handles Twitch, YouTube, and Kick. **HoneyDrunk.Integrations.Media** connects to AniList and TMDB. **HoneyDrunk.Integrations.GamingPlatforms** covers Steam, Epic, and Xbox APIs, while **HoneyDrunk.Integrations.Social** manages Discord, Twitter/X, and Reddit integrations.

## Tooling + SDKs

Ops and client devs need love too.

**HoneyDrunk.Tooling.DevOps** provides DACPAC utilities, pipeline helpers, and infrastructure scripts. **HoneyDrunk.Sdk.DotNet** gives external .NET devs an SDK to hit our APIs cleanly. And eventually, **HoneyDrunk.Sdk.JavaScript** will handle Next.js and Expo apps.

## Satellite Sites (The Consumers)

All these packages? They're not the product. They're the engine room. The actual user-facing pieces are the satellites.

The **Next.js site** is the public front door. The **Expo mobile app** handles push notifications and acts as a community nudge engine. The **Blazor admin** lets me manage users, payments, and bugs internally. And this **Astro marketing site** serves as the blog, docs, and branding hub.

**Rule #1:** satellites don't talk to databases. They hit APIs/SDKs only.

## Wrapping It Up

Every package name is a bet on the future. Go too narrow and you box yourself in. Go too vague and you build a junk drawer.

HoneyDrunk is my shot at doing it the right way: explicit names, clear boundaries, and room to grow without rewriting half the platform.

Abstractions aren't academic — they're strategy. And if I screw it up, future-me will definitely roast past-me for it.