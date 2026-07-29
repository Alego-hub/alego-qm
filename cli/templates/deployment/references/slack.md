# Slack app

QM uses one private Socket Mode app per deployment and workspace.

Run `npm exec qm -- outputs` and open the exact bot manifest creation URL.
Install the app, create an app-level token with `connections:write`, and enter
the bot and app tokens in the Admin Slack card. The Admin surface validates and
stores them without provider credentials.

Invite the bot to the chosen channel, mention it, and require a reply. Return:

```text
Bot dashboard: https://api.slack.com/apps/<bot-app-id>
Test channel: https://app.slack.com/client/<team-id>/<channel-id>
```

Keep token values out of Git, chat, and terminal output.
