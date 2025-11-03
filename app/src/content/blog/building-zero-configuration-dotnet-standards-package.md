---
title: 'Building a Zero-Configuration .NET Standards Package'
description: 'How to enforce organization-wide code quality, analyzers, and build configurations automatically using a single NuGet package with build-transitive MSBuild design.'
pubDate: 'Nov 03 2025'
heroImage: '../../assets/standards.png'
category: 'Development'
tags: ['dotnet', 'tooling']
---

## The Problem With Code Standards

Every .NET organization eventually fights the same battle: keeping code quality consistent across dozens of solutions. You copy `.editorconfig` files, manually add analyzers, and hope developers remember to fix warnings. Over time, configurations drift, rules diverge, and build quality becomes uneven.

**HoneyDrunk.Standards** solves this by turning code quality into infrastructure. It's a single NuGet package that enforces conventions, analyzers, and build configurations automatically across every project in your ecosystem.

## How It Works

### 1. Build-Transitive Package Design

The package uses MSBuild's `buildTransitive` feature, which allows its build logic to propagate to all downstream projects that reference it.
Unlike normal runtime packages, this one operates entirely at build time.

When referenced, it automatically:

- Enables `StyleCop.Analyzers` and `Microsoft.CodeAnalysis.NetAnalyzers`
- Enforces nullable reference types
- Treats warnings as errors in CI environments
- Enables deterministic builds
- Locks C# language version to latest

You don't modify your `.csproj`. You don't merge `.editorconfig`. It's zero-configuration by design.

### 2. Continuous Integration Awareness

The package detects CI systems (like GitHub Actions or Azure Pipelines) through environment variables and automatically enables `ContinuousIntegrationBuild=true`.

This provides two distinct build profiles:

- **Local development**: Fast incremental builds with absolute source paths for debugging
- **CI builds**: Deterministic, reproducible outputs with embedded source paths for traceability

The result is parity between developer machines and build servers without requiring conditional logic in your projects.

### 3. Opt-Out Instead of Opt-In

Every enforcement feature is enabled by default.
Developers can selectively disable rules via MSBuild properties, but the baseline assumes quality enforcement. This approach prevents "silent drift" where one repository quietly stops following standards.

Opt-out defaults ensure consistency across all solutions while maintaining flexibility for legitimate edge cases.

## Why This Approach Works

### Consistent Code Quality

- `StyleCop.Analyzers` enforces over 100 naming, spacing, and ordering rules
- `Microsoft.CodeAnalysis.NetAnalyzers` enforces performance, security, and reliability best practices
- Violations fail CI builds automatically, maintaining organizational quality thresholds

### Configuration Centralization

One version bump updates analyzers, language rules, and conventions across every project.
There's no need to synchronize `.editorconfig` files or manually align rule sets across repositories.

### Faster Onboarding

New developers get immediate feedback inside Visual Studio or Rider.
Standards become visible and actionable in the IDE instead of hidden in documentation.

### Deterministic and Auditable Builds

Every project builds reproducibly, producing identical binaries for the same source inputs.
That's essential for compliance, debugging, and verifying production deployments.

## Common Gotchas and Solutions

### 1. Large Warning Backlogs

Adding the package to a legacy project often triggers hundreds of analyzer warnings.
Use incremental adoption:

```xml
<NoWarn>$(NoWarn);SA*</NoWarn>
```

Then remove suppression rules as you clean up the codebase.

### 2. Missing PrivateAssets="all"

Omitting this property allows analyzers to flow transitively into your consumers, which is rarely desirable.

Always declare:

```xml
<PackageReference Include="HoneyDrunk.Standards" PrivateAssets="all" />
```

This prevents analyzer propagation and keeps the standards internal to your organization.

### 3. Test Method Naming (CA1707)

Unit test naming conventions like `MethodName_Condition_ExpectedResult` conflict with CA1707.
The package pre-suppresses this rule, prioritizing readability and established testing patterns.

### 4. Overuse of the Null-Forgiving Operator (!)

The null-forgiving operator should be reserved for proven non-null scenarios.
To maintain discipline, document any usage with an inline comment explaining why null cannot occur.

### 5. Local vs CI Output Differences

When running locally, builds embed absolute file paths.
In CI mode, paths are normalized for reproducibility.

To simulate CI locally, use:

```bash
dotnet build /p:ContinuousIntegrationBuild=true
```

This validates parity before pushing changes to a pipeline.

### 6. Team Preference Conflicts

Different teams sometimes prefer conflicting style rules (e.g., requiring or omitting `this.` prefixes).
The package allows per-project overrides in `.editorconfig`, and StyleCop can be disabled completely via:

```xml
<PropertyGroup>
  <EnableStyleCopAnalyzers>false</EnableStyleCopAnalyzers>
</PropertyGroup>
```

## Implementation Best Practices

1. **Start with a sample project**. The included `Consumer.Sample` demonstrates compliant patterns and deliberate violations.

2. **Document your rationale**. The `CONVENTIONS.md` file explains why specific rules exist, which builds trust across teams.

3. **Use versioning semantics**.
   - Minor version → new rules or non-breaking changes
   - Major version → breaking rule severity or enforcement changes

4. **Treat standards packages as infrastructure, not libraries**. They're a versioned part of your build system.

## Key Takeaways

- Build-transitive packages are the cleanest way to enforce organization-wide build and analyzer standards.
- Default-on enforcement guarantees consistency.
- Gradual adoption keeps legacy code manageable.
- Documentation matters as much as enforcement.
- `PrivateAssets="all"` prevents downstream dependency pollution.

## Try It Yourself

```xml
<PackageReference Include="HoneyDrunk.Standards" PrivateAssets="all" />
```

That single line brings your organization in line with modern, deterministic .NET build standards.

**Repository**: [github.com/HoneyDrunkStudios/HoneyDrunk.Standards](https://github.com/HoneyDrunkStudios/HoneyDrunk.Standards)

**Docs**: Conventions guide, naming policies, nullable handling, and migration strategies.

---

Have you implemented your own internal standards package? What challenges did you hit during rollout? Share them — the goal is a future where "code style review" is no longer a recurring meeting topic.
