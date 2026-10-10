---
title: 'AI Can Write the Code. Who Owns the Architecture?'
description: 'What building Pocket Quests with Codex and Claude taught me about service boundaries, mapping, persistence, and owning the architecture.'
pubDate: 'Oct 10 2026'
heroImage: '../../assets/ai-architecture-ownership-cover-tattooed-v2.png'
category: 'Development'
tags: ['ai', 'architecture', 'dotnet', 'honeydrunk']
---
I use Codex and Claude extensively to build HoneyDrunk projects. They write a lot of the implementation. I describe the behavior, inspect what comes back, and decide whether it belongs in the system I am trying to build.

Pocket Quests has been a useful reminder of how much work sits inside that last part.

As the backend grew, I kept running into mutation and change-binding abstractions, repeated comparisons against historical values, large methods assembling entire aggregates, and field-by-field mapping mixed into business services. Each piece added something else I had to understand before I could follow the operation.

What frustrated me was having to explain the same conventional structure repeatedly. I wanted to discuss what completing a quest should do. Instead, I was spending time explaining where validation belonged, why mapping needed its own files, and why we were building another mechanism around changes EF Core already tracks.

A generated document can list KISS, SOLID, and DRY. I still have to open the code and check whether those principles affected any decisions.

That is where architectural ownership becomes very concrete. Someone has to decide which responsibilities belong together, which dependencies are acceptable, and whether a new abstraction earns its place. In my projects, that responsibility stays with me.

The structure I wanted was straightforward: minimal API endpoints call business service interfaces. Services own the business operation and call static validators, separate mapping extensions, and data-service interfaces. Data services handle queries and persistence through EF Core and the DbContext.

An endpoint should make the HTTP boundary easy to understand. A service should make the business operation easy to understand. When I need to inspect a query, I should know where to find it.

That is a deliberate choice for these applications. Another team might organize the same responsibilities differently and have good reasons for it. My concern is whether the chosen structure stays consistent enough that the next feature does not require another architecture discussion.

Mapping is a good example because it looks harmless until it fills half a method.

Copying a quest's title, description, category, and other selected values into a persistence model is routine mapping. I want that in a named mapping extension. The service can then show the decisions around it: validate the request, identify the account, select the applicable rules, decide what needs recording, and call the data services.

There is a limit to that extraction. Deciding whether a quest needs a new historical revision is business behavior. Choosing which reward rules apply is business behavior. A mapper should receive those decisions as inputs. Moving them into a method called `ToEntity` would make them harder to find.

The same applies to large methods that construct a whole aggregate. Some coordination belongs in a service, and pure domain rules can remain in the domain model. But when the coordination is buried among dozens of assignments, it becomes difficult to see what the operation actually promises. Separating the field copying makes the remaining business decisions easier to review.

Historical data needs particular care in Pocket Quests. Completing a quest, undoing a completion, and processing an action that arrived late can depend on earlier facts. EF can notice that a tracked property changed. It cannot decide whether the product needs another immutable revision or which earlier terms should govern an action.

Those decisions need an explicit owner. If several paths compare the same historical values for the same reason, I want that rule in one focused place. I also want to understand any differences before combining them. Two similar comparisons can represent different business questions.

For ordinary updates, the persistence path should stay ordinary: load the tracked entity, change the intended properties, and let EF detect the changes. A separate change-binding mechanism needs to solve a real problem beyond describing those assignments again.

Transactions deserve the same restraint. A simple operation covered by one `SaveChanges` call usually has the transactional behavior it needs with a relational provider. Explicit transaction control should follow the operation's consistency requirements. Pocket Quests has commands that coordinate history, progress, and receipts, with locking and retry concerns. Those requirements justify more care; a single write does not automatically justify another transaction wrapper.

I want the EF configuration to be equally readable. Configure the contracts and differences that matter: keys, relationships, lengths, precision, concurrency, and required index behavior. Leave ordinary conventions alone. Removing a line still requires understanding its effect on the resulting model and schema.

This carries through to the repository layout. Quest entities, mappings, queries, and SQL tables should sit under consistent domain folders in their respective projects. Following a feature across layers should be predictable.

Table and column descriptions matter here too. A timestamp might mean when the server inserted a row or when an offline action actually happened. That distinction affects behavior. Metadata should explain it. An index should have a query or constraint behind it that I can point to.

Ownership also extends beyond Pocket Quests. HoneyDrunk has shared repositories, and I want reusable components in the repository responsible for them. Before adding another helper, I want the agent to look at what already exists and verify that it actually does the required job.

Quest progression rules belong with the product. Reusable persistence mechanics may belong in a shared library. The dependency should reflect that ownership. A plausible package name or a catalog entry is not enough evidence that the capability exists and works for this use case.

This is what KISS, SOLID, and DRY mean to me in a review. I can follow the operation. Each component has a coherent job. The same policy has one maintained implementation. Adding interfaces everywhere or pushing unrelated helpers into a shared package does not establish any of that.

I also need those expectations to survive the next session. The root `AGENTS.md` should point to canonical standards and the repository's specific boundaries. Maintaining several copies gives me several places to correct the same decision later.

That gives Codex and Claude a clear starting point. I still need to verify that the instructions were available and that the implementation follows them. Writing down the standard is one step; applying it across existing code takes further work.

CI, Sonar, and reviews help with that work. Tests can check behavior. Analysis can identify duplication and other problems. Review can follow a request through its dependencies and question the design. A green result tells me something useful about the checks that ran. It cannot settle whether a responsibility belongs in this repository or whether an abstraction is worth maintaining.

I want to keep using both tools to build more. I also want the resulting code to stay understandable when I come back to it, or when another agent starts the next feature.

That means I still own the boundaries, the trade-offs, and the decision to accept the result. AI can write the implementation. I have to be able to explain why it is built that way.
