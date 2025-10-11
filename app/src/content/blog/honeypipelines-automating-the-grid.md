---
title: 'HoneyDrunk.Pipelines — Automating the Grid'
description: 'Behind the scenes of building HoneyDrunk.Pipelines: reusable YAML templates, centralized CI/CD, and turning pipeline chaos into infrastructure-as-code.'
pubDate: 'Oct 11 2025'
heroImage: '../../assets/neon-pipeline.png'
tags: ['azure devops', 'pipelines', 'yaml', 'nuget', 'dotnet', 'ci/cd', 'artifacts', 'templates', 'automation']
---

## This Week in The Hive

We hit a snag this week. A simple NuGet push to our private feed failed — again. Permissions were broken, the service connection was misconfigured, and somewhere in the mess of copy-pasted YAML, a GUID got mangled. Sound familiar?

For HoneyDrunk Studios, a one-person operation building multiple .NET libraries, this kind of friction compounds fast. Every project had its own pipeline. Every pipeline was slightly different. Every change meant updating three repos. It was time to **treat CI/CD like infrastructure**.

Enter **HoneyDrunk.Pipelines** — our centralized, reusable Azure DevOps pipeline templates. This post walks through how we turned pipeline pain into a system: one template repo to rule them all.

---

## The Problem: Pipeline Sprawl and Permission Hell

Before HoneyDrunk.Pipelines, our CI/CD looked like this:

- Each repo had its own `azure-pipelines.yml` with duplicated logic
- NuGet feed permissions were configured per-project (and often wrong)
- Build configurations (versioning, tagging, artifact naming) were inconsistent
- A single change (like updating the .NET SDK version) required touching every pipeline

The breaking point? Publishing a library to our internal feed. The build service account didn't have `Contributor` access. The service connection used a stale PAT. The package GUID in the feed URL was copy-pasted incorrectly. **Three separate failures, all permission-related, all invisible until runtime.**

### Why Isolated Pipeline Templates Matter

Pipeline logic is code. And like any code, it needs:

- **Single source of truth** — one template, many consumers
- **Version control** — changes are tracked, reviewed, tested
- **Composability** — stages, jobs, and steps as reusable blocks
- **Separation of concerns** — build logic ≠ project-specific config

Without this, you're not automating — you're copy-pasting with extra steps.

---

## The Solution: Centralized Templates + Transitive Config

We built two repos to solve this:

1. **HoneyDrunk.Pipelines** — Reusable YAML templates for stages, jobs, and steps
2. **HoneyDrunk.Build** — Transitive build configuration (MSBuild props, versioning, package metadata)

### Architecture Overview

```
HoneyDrunk.Pipelines (this repo)
├── jobs/
│   ├── deploy-dacpac.job.yaml
│   ├── dotnet-build-pack.job.yaml
│   ├── dotnet-publish-package.job.yaml
│   ├── pr-summary.job.yaml
│   └── test-validation.job.yaml
├── stages/
│   ├── build-dacpac.stage.yaml
│   ├── database-pipeline.stage.yaml
│   ├── deploy-dacpac.stage.yaml
│   ├── dotnet-publish.stage.yaml
│   └── pr-validation.stage.yaml
├── steps/
│   ├── build-with-warnings-as-errors.step.yaml
│   ├── checkout-source.step.yaml
│   ├── code-format-validation.step.yaml
│   ├── debug-build-identity.step.yaml
│   ├── deploy-dacpac.step.yaml
│   ├── dotnet-build.step.yaml
│   ├── dotnet-pack.step.yaml
│   ├── dotnet-push.step.yaml
│   ├── dotnet-restore-build.step.yaml
│   ├── dotnet-restore.step.yaml
│   ├── dotnet-test.step.yaml
│   ├── download-nuget-artifact.step.yaml
│   ├── find-single-dacpac.step.yaml
│   ├── generate-pr-summary.step.yaml
│   ├── install-dotnet-sdk.step.yaml
│   ├── post-pr-comment.step.yaml
│   ├── preflight-var-check.step.yaml
│   ├── publish-artifact.step.yaml
│   ├── publish-nuget-artifact.step.yaml
│   ├── publish-security-scan-results.step.yaml
│   ├── publish-test-results.step.yaml
│   ├── security-vulnerability-scan.step.yaml
│   ├── setup-nuget-cache.step.yaml
│   ├── sonarqube-analyze.step.yaml
│   ├── sonarqube-prepare.step.yaml
│   ├── sonarqube-publish-quality-gate.step.yaml
│   ├── validate-test-displayname.step.yaml
│   ├── validate-test-naming.step.yaml
│   └── vsbuild-sqlproj.step.yaml
└── README.md

Consumer Repo (e.g., a "Build" library)
└── azure-pipelines.yml              # Points to HoneyDrunk.Pipelines templates
```

Each consumer repo references the centralized templates via Azure Repos resource:

```yaml
# filepath: example azure-pipelines.yml in consumer repo
resources:
  repositories:
    - repository: pipelines
      type: git
  name: HoneyDrunk/HoneyDrunk.Pipelines
      ref: refs/heads/main

trigger:
  branches:
    include:
      - main
      - develop

stages:
  # Build, test, and validate on PRs/commits
  - template: stages/pr-validation.stage.yaml@pipelines
    parameters:
  projectPath: 'src/Build/Build.csproj'
      runTests: true

  # Publish packages (typically gated to main)
  - template: stages/dotnet-publish.stage.yaml@pipelines
    parameters:
      packagePath: '$(Build.ArtifactStagingDirectory)/**/*.nupkg'
      feedName: 'HoneyDrunk-Internal'
```

### Stage Template: PR Validation

Here's the `pr-validation.stage.yaml` that composes restore, build, test, and pack using step templates:

```yaml
# filepath: stages/pr-validation.stage.yaml (placeholder - add your actual template)
parameters:
  - name: projectPath
    type: string
  - name: configuration
    type: string
    default: 'Release'
  - name: runTests
    type: boolean
    default: true
  - name: dotnetVersion
    type: string
    default: '9.x'

stages:
  - stage: PR_Validation
    displayName: 'Build, Test, and Validate'
    jobs:
      - job: BuildJob
        displayName: 'Build ${{ parameters.projectPath }}'
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          # Use modular step templates
          - template: ../steps/install-dotnet-sdk.step.yaml
            parameters:
              dotnetVersion: ${{ parameters.dotnetVersion }}
          
          - template: ../steps/dotnet-restore-build.step.yaml
          
          - template: ../steps/dotnet-build.step.yaml
            parameters:
              projectPath: ${{ parameters.projectPath }}
              configuration: ${{ parameters.configuration }}
          
          - ${{ if eq(parameters.runTests, true) }}:
            - template: ../steps/dotnet-test.step.yaml
              
          - template: ../steps/dotnet-pack.step.yaml
            parameters:
              projectPath: ${{ parameters.projectPath }}
              configuration: ${{ parameters.configuration }}
```

### Step Template: NuGet Publish

The `dotnet-push.step.yaml` handles the authentication and push logic that was failing before:

```yaml
# filepath: steps/dotnet-push.step.yaml (placeholder - add your actual template)
parameters:
  - name: packagePath
    type: string
  - name: feedName
    type: string
  - name: serviceConnection
    type: string
    default: 'HoneyDrunk-AzureDevOps'

steps:
  - task: NuGetAuthenticate@1
    displayName: 'Authenticate with Azure Artifacts'
    inputs:
      nuGetServiceConnections: ${{ parameters.serviceConnection }}
  
  - task: DotNetCoreCLI@2
    displayName: 'Push to ${{ parameters.feedName }}'
    inputs:
      command: 'push'
      packagesToPush: ${{ parameters.packagePath }}
      nuGetFeedType: 'internal'
      publishVstsFeed: 'HoneyDrunk/${{ parameters.feedName }}'
      allowPackageConflicts: false
```

### Transitive Build Configuration

`HoneyDrunk.Build` contains `Directory.Build.props` and `Directory.Packages.props` that get referenced by all projects:

```xml
<!-- filepath: HoneyDrunk.Build/Directory.Build.props (placeholder - add your actual config) -->
<Project>
  <PropertyGroup>
    <!-- Versioning -->
    <VersionPrefix>1.0.0</VersionPrefix>
    <VersionSuffix Condition="'$(BUILD_SOURCEBRANCH)' != 'refs/heads/main'">preview</VersionSuffix>
    
    <!-- Package metadata -->
    <Authors>TattedDev</Authors>
    <Company>HoneyDrunk Studios</Company>
    <PackageProjectUrl>https://github.com/HoneyDrunk</PackageProjectUrl>
    <RepositoryUrl>https://github.com/HoneyDrunk/$(MSBuildProjectName)</RepositoryUrl>
    <PackageLicenseExpression>MIT</PackageLicenseExpression>
    
    <!-- Build settings -->
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
```

---

## The Fix: Feed Permissions and Service Connections

The original failure had three causes:

### 1. Build Service Account Permissions

Azure Pipelines uses a build service account (`[Project] Build Service ([Organization])`). This account needs `Contributor` access to your Azure Artifacts feed:

```bash
# Navigate to: Azure Artifacts → Feed Settings → Permissions
# Add: [Project] Build Service ([Organization])
# Role: Contributor
```

### 2. Service Connection vs Build Service

We were using a service connection with a PAT, but `NuGetAuthenticate@1` works better with the build service identity. Updated the template to use `nuGetServiceConnections` only when explicitly needed (e.g., cross-organization pushes).

### 3. Feed URL and GUID

The feed URL must include the correct organization and feed GUID:

```
https://pkgs.dev.azure.com/{organization}/_packaging/{feedName}/nuget/v3/index.json
```

We parameterized this in the template so it's generated consistently:

```yaml
# filepath: steps/dotnet-push.step.yaml (feed URL construction)
- script: |
    FEED_URL="https://pkgs.dev.azure.com/$(System.TeamFoundationCollectionUri | sed 's|https://dev.azure.com/||')/_packaging/${{ parameters.feedName }}/nuget/v3/index.json"
    echo "##vso[task.setvariable variable=FeedUrl]$FEED_URL"
  displayName: 'Construct Feed URL'
```

---

## The Takeaway: CI/CD as Infrastructure

### Key Principles

1. **Treat pipelines like code** — version control, reviews, testing
2. **Compose, don't duplicate** — stages → jobs → steps, each reusable
3. **Centralize configuration** — one place to update .NET versions, feed URLs, etc.
4. **Fail fast, fail visible** — permissions errors should surface in CI, not at publish time

### Benefits We've Seen

- **5 repos now use the same templates** — one update propagates everywhere
- **Zero permission issues** since fixing the feed access pattern
- **Consistent versioning** across all HoneyDrunk packages
- **Faster onboarding** for new projects (copy 10 lines of YAML, not 100)

### Example: Adding a New Project

Before HoneyDrunk.Pipelines:
1. Copy a pipeline from another repo (~100 lines)
2. Find/replace project names (miss a few, debug for 20 minutes)
3. Fix feed URL, service connection, artifact paths
4. Test locally (can't), push, watch it fail, repeat

After HoneyDrunk.Pipelines:
1. Create `azure-pipelines.yml` (10 lines, reference templates)
2. Set project path and feed name
3. Push. It works.

---

## Showcase: The Full Pipeline

Here's a complete example from a consumer library:

```yaml
# filepath: azure-pipelines.yml (consumer library)
resources:
  repositories:
    - repository: pipelines
      type: git
  name: HoneyDrunk/HoneyDrunk.Pipelines
      ref: refs/heads/main

trigger:
  branches:
    include:
      - main
      - develop
  paths:
    include:
  - src/Build/**

variables:
  - group: NuGetPublishing

stages:
  # Stage 1: Build and test
  - template: stages/pr-validation.stage.yaml@pipelines
    parameters:
  projectPath: 'src/Build/Build.csproj'
      configuration: 'Release'
      runTests: true
      dotnetVersion: '9.x'
  
  # Stage 2: Publish to internal feed (on main branch)
  - template: stages/dotnet-publish.stage.yaml@pipelines
    parameters:
      dependsOn: PR_Validation
      condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
      packagePath: '$(Build.ArtifactStagingDirectory)/**/*.nupkg'
      feedName: 'HoneyDrunk-Internal'
```

**10 lines of project-specific config. The rest is infrastructure.**

---

## Reflection: Why This Matters for a Solo Studio

HoneyDrunk Studios is one person. That means:

- **Time is the constraint** — every hour on pipeline debugging is an hour not building games
- **Context switching kills** — I need to think about game logic, not YAML indentation
- **Future-me will forget** — six months from now, I won't remember why the feed URL is broken

Investing in build discipline now means:

- **Faster iteration** — new libraries go from idea to published in minutes
- **Confidence to refactor** — automated tests run on every push
- **Scalability** — when (if?) the studio grows, the infrastructure is already there

Pipeline automation isn't just for big teams. It's **force multiplication for solo developers**.

---

## Next Steps

If you're building your own pipeline system:

1. **Start with one template** — don't boilerplate the whole thing at once. Start with a `build-job.yml` and expand.
2. **Parameterize everything** — project paths, feed names, .NET versions. Make it reusable from day one.
3. **Document the happy path** — write a 5-line example in your README. Future-you will thank you.
4. **Test with a throwaway project** — don't debug on your production repo.

For HoneyDrunk, the next evolution is adding **release notes automation** (from commit messages) and **semantic versioning** (from conventional commits). But that's a post for another week.

---

## Resources

- [Azure Pipelines YAML Schema](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/)
- [Azure Artifacts Permissions](https://learn.microsoft.com/en-us/azure/devops/artifacts/feeds/feed-permissions)
- Centralized pipelines repo (internal, not publicly accessible)

---

**Build once. Reuse forever. That's the way.**
