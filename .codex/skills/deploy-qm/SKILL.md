---
name: deploy-qm
description: Deploy the QM package from an organization-owned repository into Fly.io or AWS, onboard an administrator, configure connectors, and optionally activate Slack.
---

# Deploy QM

Read [`../../../deployment.md`](../../../deployment.md) completely and follow it
as the authoritative workflow. Read only the selected provider reference. Read
`references/email.md` before collecting secrets, because sign-in needs an email
transport and one of its steps needs the operator's DNS. Read
`references/slack.md` only when Slack is requested.

Use the installed `@yc-software/qm` dependency through `npm exec qm -- <command>`. Do
not require or clone the QM source repository. Complete every acceptance check
and return the handoff required by `deployment.md`.
