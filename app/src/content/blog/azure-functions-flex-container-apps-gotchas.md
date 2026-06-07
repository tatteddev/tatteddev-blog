---
title: 'A Field Guide to Hand-Provisioning Azure Functions and Container Apps'
description: 'The war stories from standing up dev environments by hand on Azure Functions Flex Consumption and Container Apps, where the platform tooling returned null, lied about hostnames, or refused to run at all.'
pubDate: 'Jun 07 2026'
heroImage: '../../assets/az-functions.png'
category: 'Development'
tags: ['azure', 'devops', 'serverless', 'honeydrunk', 'tooling']
---

I asked the Azure CLI for my function app's hostname and it handed me back `null`. The app was running. The hostname existed. The tool whose entire job is to tell me about the app just refused to say what it was. That was the first of a week's worth of moments where the platform looked me in the eye and lied.

I'd been standing up cloud services on Azure by hand, one small repo at a time, some running as Azure Functions and some as Container Apps. I do this solo, so each one starts as a hello-world placeholder, gets something trivial running, then grows into the real service as I add whatever it turns out to need. The work itself was fine. The part that cost me evenings was Azure's own tooling handing me wrong answers while I did it. I'd ask the CLI a direct question and get back `null`. I'd hit the hostname the docs implied and get a connection that failed completely. I'd reach for the official deploy action and find it blocked. Every one of these burned an evening of squinting at output that made no sense, usually around midnight, usually while googling the exact error and finding nothing.

This is the post I wish I'd found on one of those nights. Five concrete gotchas, each with the symptom I actually saw and the fix that actually worked. If you're hand-standing-up Functions or Container Apps on Azure and the platform is gaslighting you, start here.

A bit of grounding first, because this blog gets read by people who don't know my stack. **Flex Consumption** is a newer Azure Functions hosting plan, the pay-for-what-you-use serverless tier with faster scaling than the old Consumption plan. **Container Apps** is Azure's managed platform for running containers without standing up Kubernetes yourself. A **managed identity** is an Azure-issued identity attached to your app so it can authenticate to other Azure services without you storing a password. An **RBAC role assignment** is the grant that says "this identity is allowed to do this specific thing." Those four show up in every story below.

---

## Gotcha 1: `az functionapp show` returns null on Flex Consumption

**Symptom.** I deployed a Function on the Flex Consumption plan and went to grab its basic facts the obvious way:

```bash
az functionapp show --name <app> --resource-group <rg> \
  --query "{host:defaultHostName, state:state, names:hostNames}"
```

Back came `null` for `defaultHostName`, `null` for `state`, `null` for `hostNames`. Not an error. Not an empty string. Just null fields on an app I could see existed in the Portal.

**Cause.** On Flex Consumption those properties simply aren't populated on the object `az functionapp show` reads. The command works fine elsewhere. On this plan it just doesn't surface those fields through that path, so you ask a perfectly reasonable question and the tool answers with a confident nothing.

**Fix.** Go around it. Read the resource directly through the generic resource commands or the ARM REST API:

```bash
# Generic resource read returns the populated properties
az resource show --ids <function-app-resource-id> \
  --query "properties.defaultHostName"

# Or hit ARM directly
az rest --method get --url "<function-app-resource-id>?api-version=<api-version>"
```

`az resource show` and `az rest` read the underlying resource record, where the real values live. The lesson I took from this: when a high-level `az` command hands you null on a newer plan, drop down a layer before you assume your app is broken. The app was fine. The convenience command just couldn't see it.

---

## Gotcha 2: the hostname you expect returns HTTP 000

**Symptom.** Once I had a hostname, I tried to hit the app at the address you'd guess from years of Azure muscle memory: `<app-name>.azurewebsites.net`. The request didn't return a 404. It didn't return a 503. It returned HTTP 000, which is curl's way of telling you the connection never completed at all. The host wasn't answering on that name, period.

**Cause.** Flex Consumption apps answer only on a regional hostname shaped like this:

```
<app-name>-<hash>.<region>-01.azurewebsites.net
```

The bare `<app-name>.azurewebsites.net` you'd expect, the one every older tutorial uses, just isn't a live endpoint for these apps. So you're hitting an address that resolves to nothing useful and getting a dead connection for your trouble.

**Fix.** Use the regional hostname, and get it from the resource itself rather than constructing it by hand:

```bash
az resource show --ids <function-app-resource-id> \
  --query "properties.defaultHostName" --output tsv
```

This one is nasty because it compounds with Gotcha 1. The tool that should hand you the correct hostname returns null, so you fall back to guessing, and the address you guess refuses the connection. Two failures stacked: the right answer is hidden, and the wrong answer fails silently. Once I knew the regional shape was the only one that answers, the dead connections stopped being a mystery.

---

## Gotcha 3: the official deploy GitHub Action was blocked

**Symptom.** I was deploying my Functions from GitHub Actions using `azure/functions-action`, the official Microsoft-published action for the job. At some point it became unusable in my setup for terms-of-service reasons. The action I'd built my deploy step around was off the table.

**Cause.** This one came down to a licensing and terms constraint on using that action in my context. Doesn't matter how clean your workflow is if the step it depends on is contractually off the table.

**Fix.** Drop the action and deploy with the `az` CLI directly inside the workflow. The CLI does the same job without the dependency on a third-party action:

```yaml
# filepath: .github/workflows/deploy.yml
- name: Deploy function app
  run: |
    az functionapp deployment source config-zip \
      --name "$APP_NAME" \
      --resource-group "$RG" \
      --src "$ZIP_PATH"
```

I made this change in my Actions repo and never looked back (the commit that dropped the action lives in my history as `17b7362`). The broader takeaway: a deploy step that leans on a single vendor action is a step that can disappear out from under you. The `az` CLI is the stable substrate. When an action gets blocked or deprecated, the CLI underneath it almost always still does the work.

---

## Gotcha 4: Container Apps probes defaulted to port 80, my app listens on 8080

**Symptom.** A hand-provisioned Container App came up and looked dead. Ingress was reachable in name but every health probe failed, so the platform kept treating the revision as unhealthy and cycling it. The container itself was running fine. The platform just couldn't get a healthy response out of it.

**Cause.** The app came up with ingress and health probes pointed at port 80. My container listens on 8080. So every probe knocked on a door nobody was behind, marked the app unhealthy, and the app looked broken while being completely fine internally.

**Fix.** Set the ingress target port and the probe ports to where the app actually listens:

```bash
az containerapp ingress update \
  --name <app> --resource-group <rg> \
  --target-port 8080
```

And make sure any liveness and readiness probes point at 8080 too, not the default. This is a small fix that wastes a lot of time, because "running but failing every health check" presents exactly like a crashed app from the outside. The first thing I check now on any new Container App is whether the probe port and the listen port agree.

---

## Gotcha 5: role assignments threw MissingSubscription, so I used az rest

**Symptom.** A freshly hand-made app has none of the permissions it needs. I went to grant its managed identity the roles it required:

- **AcrPull**, so it can pull its own container image from the registry.
- **Key Vault** access, so it can read its secrets (Key Vault is Azure's managed secret store).
- **App Configuration Data Reader**, so it can read its config (App Configuration is Azure's managed settings store).

The obvious command for each grant is `az role assignment create`. In my environment it threw a `MissingSubscription` error and refused to make the assignment. The subscription context was set, other commands worked, but this specific path insisted it couldn't find a subscription.

**Cause.** I never got a clean root cause for the `MissingSubscription` failure on that command in my setup. What I could prove was that the same role assignment went through fine when I made it against the ARM REST API directly.

**Fix.** Create the role assignments through `az rest`, calling the management API yourself:

```bash
az rest --method put \
  --url "<scope>/providers/Microsoft.Authorization/roleAssignments/<guid>?api-version=<api-version>" \
  --body '{
    "properties": {
      "roleDefinitionId": "<role-definition-id>",
      "principalId": "<app-managed-identity-principal-id>",
      "principalType": "ServicePrincipal"
    }
  }'
```

It's more verbose, you build the request body by hand, but it works where the convenience command wouldn't.

The deeper problem here is the shape of the whole situation, well beyond the one error. A freshly hand-made app is missing every one of these by default: AcrPull, Key Vault access, App Configuration Data Reader, joining the managed environment, and having its App Configuration store seeded with the keys it expects. Nothing tells you any of them are missing. The app doesn't announce "I have no permission to pull my image." It just fails quietly, one missing grant at a time, and you discover each one by watching the app fail in a slightly new way and reasoning backward to what it must have needed.

---

## What I Took From All of It

Every fix above was applied live, by hand, to a running dev environment, discovered by trial and error at the moment the thing broke. None of it was in a runbook, because there was no runbook. The whole sequence lived in trial-and-error scar tissue and nowhere a teammate, or a future me, could go look it up.

There's a thread running through all five. The platform's convenient answer was the wrong one often enough that I learned to drop a layer down by reflex. `az functionapp show` lies on Flex, so read the resource directly. The friendly hostname is dead, so pull the regional one off the resource. The official action is blocked, so call the CLI underneath it. The defaults point at the wrong port, so set them explicitly. The role-assignment helper fails, so hit ARM directly. The generic, lower-level path was the reliable one almost every time.

This pile of hand-fixes is exactly what pushed me to describe my infrastructure in Bicep instead, so the next environment is reviewed as code before it exists rather than debugged after (that's its own post). But that's the cure. This post is the disease, written down, so the next person googling `HTTP 000 azurewebsites.net flex consumption` at midnight finds something.

When the platform tells you null, don't believe it. Go ask the resource.
