---
title: 'Treating Azure Infrastructure Like a Pull Request: Bicep and what-if'
description: 'Why provisioning Azure from memory survived one environment and broke on the second, and how I made every resource a reviewable Bicep diff with a dry run before anything applies.'
pubDate: 'Jun 07 2026'
heroImage: '../../assets/bicep.png'
category: 'Development'
tags: ['devops', 'azure', 'architecture', 'honeydrunk', 'tooling']
---

For a long time, the complete and authoritative definition of my production infrastructure was a scratch file of `az` commands and the order I remembered running them in. I'd click through the Azure Portal, paste in a few commands, and the service would come up: a container app, a Key Vault, some App Configuration, a Service Bus namespace, the role assignments that wire them together. It worked.

It worked because I remembered the sequence. There was an order to it, a set of steps that mattered, and the only place that order lived was in my head. That holds up fine when there's one environment and you set it up once. It falls apart the moment you need a second one. I run a lot of these services solo, so "I'll just remember it" had quietly become the load-bearing plan across every repo I own.

This post is about the moment I needed a second environment, watched my from-memory process fall apart on contact, and decided to stop provisioning from memory entirely. The fix has a thesis I'll keep coming back to: infrastructure should be a diff you review before it lands, the same way code is.

---

## The Problem: I Provisioned From Memory

Here's what "provisioning from memory" actually looked like in practice.

My dev environment apps started life as hello-world placeholders. I'd create a container app in the Portal, get something trivial running, and then evolve it into the real service over time. Every time I did that, the real service needed things the placeholder didn't, and I added them by hand, one at a time, as I noticed they were missing.

The list of things I noticed missing, the hard way:

- The app's managed identity had no **AcrPull** role, so it couldn't pull its own container image from the registry.
- It had no **Key Vault** or **App Configuration** read access, so it couldn't load any of its config or secrets.
- It had never actually **joined the shared Container Apps environment**, so it wasn't wired into the logging and networking I assumed it was.
- The **App Configuration store was never seeded** with the keys the app expected to find.
- Ingress was configured for **port 80** with health probes pointed there, while the app actually listens on **8080**. So it was "running" and failing every health check.

Every one of those was fixed live, by hand, while the thing was already deployed and broken. And the role assignments in particular fought me: the obvious `az role assignment create` path kept throwing a `MissingSubscription` error in my setup, so I ended up making the RBAC grants through raw `az rest` calls against the management API instead. Each fix was a small thing. The sum of them was a service that only worked because I'd personally walked it through a recovery I never wrote down.

The real failure was bigger than any single missing role. The complete, correct sequence for standing up one of my services lived only in my own hands, a thing I had done and could repeat but could never open and read. There was no artifact. There was no review. If someone asked me "what does it take to bring this service up in a fresh region for disaster recovery," the honest answer was "give me a day and let me remember."

So when a second environment showed up on the roadmap, I didn't want to redo the from-memory walk. I wanted the walk to be a file.

---

## What Bicep Is (and What It Buys a Solo Dev)

The tool I committed to is Bicep. If you haven't used it: Bicep is Microsoft's own infrastructure-as-code language for Azure. You describe the resources you want in a terse, typed DSL, and it compiles down to ARM, the JSON template format Azure deploys natively. There's no separate state file to manage the way Terraform has one; a deployment reconciles directly against whatever already exists in Azure. For an Azure-only shop run by one person, that's one fewer artifact to secure and back up, which I appreciated.

I put all of it in one repo. Reusable modules are organized by concern (compute, data, secrets, messaging, observability) and a composition template stitches them together per environment. The modules are referenced by plain local file paths. I looked at publishing them to a Bicep registry and decided against it; for a single operator, a registry was overhead with no payoff, so modules just sit next to the templates that consume them and resolve off the filesystem at build time.

The shared foundation for an environment composes the pieces that no single service owns:

```bicep
// filepath: platform/main.bicep
module containerAppEnvironment '../modules/compute/containerAppEnvironment.bicep' = {
  name: 'platform-cae'
  params: {
    env: env
    location: location
    tags: tags
    logAnalyticsWorkspaceId: logAnalyticsWorkspace.outputs.id
  }
}

module appConfigurationStore '../modules/secrets/appConfigurationStore.bicep' = {
  name: 'platform-appcs'
  params: {
    env: env
    location: location
    tags: tags
  }
}
```

The interesting part is what's now impossible to forget. Remember the port-80-versus-8080 mess? Here's the relevant slice of the container app module:

```bicep
// filepath: modules/compute/containerApp.bicep
@description('Ingress target port the container listens on.')
param targetPort int = 8080

resource containerApp 'Microsoft.App/containerApps@2025-07-01' = {
  name: 'ca-hd-${service}-${env}'
  identity: { type: 'SystemAssigned' }
  properties: {
    managedEnvironmentId: containerAppEnvironmentId
    configuration: {
      ingress: {
        external: externalIngress
        targetPort: targetPort
        transport: 'auto'
      }
    }
    // ...
  }
}

@description('Principal ID of the system-assigned managed identity. Grant AcrPull / Key Vault / App Configuration RBAC to this.')
output principalId string = containerApp.identity.principalId
```

The port default is 8080, written down once, applied everywhere. The module won't deploy a container app without joining the managed environment, because `managedEnvironmentId` is a required parameter. The managed identity's principal ID comes out as an output specifically so the role assignments (the AcrPull, the Key Vault read, the App Configuration read) get wired to it in the same deploy instead of being remembered later. Every individual thing that bit me by hand is now a property of a file that gets compiled and checked.

That's the difference between memory and code: the file can't quietly skip a step.

---

## Infra as a Diff You Review Before It Lands

Having the resources in Bicep is half of it. The half I actually care about is what happens when I change them.

Azure has a command called `what-if`. It's a dry run: you point it at a template and it tells you exactly what a real deployment *would* do (what it would create, what it would modify, what it would delete) without touching anything. It prints a diff of your infrastructure.

My deploy pipeline is built around that command. Before it applies anything, it runs the same three preflight steps every time: compile the Bicep, lint it, then run `what-if`. Only after that does it consider applying. And whether it applies at all is a switch:

```yaml
# filepath: .github/workflows/job-deploy-bicep.yml
- name: What-if preflight
  run: |
    az deployment group what-if \
      --resource-group "$RG" \
      --parameters "$PARAMS"

- name: Apply deployment
  if: ${{ inputs.what-if-only != true }}
  run: |
    az deployment group create \
      --name "hd-infra-${ENV}-${RUN_ID}-${RUN_ATTEMPT}" \
      --resource-group "$RG" \
      --parameters "$PARAMS"
```

I trigger deploys in two modes. **Plan** runs the build, lint, and `what-if`, then stops and tells me nothing was applied. **Apply** does all of that and then actually deploys. The default is plan. So my normal loop is: run plan, read the diff, confirm it's doing what I expect, then re-run as apply.

Reading the diff is the whole point. The discipline I hold myself to is simple: every resource that should already exist needs to show up as **no change**. If something I wasn't expecting shows as Modify or, worse, Delete, that's the signal to stop and look before anything happens to live infrastructure. The dry run turns "I think this is safe" into "I can see that this is safe."

That's why I call it treating infrastructure like a pull request. A pull request is a diff you read before you merge it. `what-if` is a diff you read before you deploy it. Same loop, same safety, just pointed at Azure resources instead of source files. The change stops being an action I take from memory and becomes a proposal I review.

Two supporting pieces, each worth only a sentence here because each could be its own post. The pipeline authenticates to Azure with GitHub's OIDC federation, so there are no long-lived Azure credentials stored anywhere; the deploy identity is allowed to provision resources but not to read secret values. And promotion across environments is gated: dev is easy, while staging and prod sit behind GitHub Environment approvals so nothing reaches them without a deliberate sign-off. Both of those deserve their own write-ups later.

---

## The Payoff

The real fix was turning that memory into an artifact, something I could read, review, and re-run. Trying to remember harder was never going to survive past one environment.

Once the infrastructure was a set of files, the part that used to terrify me (standing up another environment) became boring in the best way. A new environment is a new parameter file pointed at the same modules. The sequence I used to carry in my head is now enforced by required parameters and module composition. The container app can't come up without joining its environment. The identity comes out as an output so its roles get granted in the same breath. The port is 8080 because the file says so.

And the dry run changed how changes *feel*. Before, every `az` command against a real environment was a small leap of faith. Now I get to look first. The worst-case surprise moved from "I deleted something in production" to "the plan showed something I didn't expect, so I didn't run apply." That's a much better worst case to live with when there's no one else around to catch the mistake.

---

## What's Left to Codify

There's more to build on top of this. The role assignments and App Configuration seeding that I described as the painful hand-fixes are exactly the parts I want fully codified into the per-service templates next, so that "fresh environment" means one plan-and-apply with nothing left to remember. And the environment-gated promotion model deserves its own post, because the approval gates are doing real work.

But the load-bearing change already happened. My infrastructure stopped being a thing I remember how to do and became a thing I can read. Provision from a file, not from memory. Look at the diff before it lands.
