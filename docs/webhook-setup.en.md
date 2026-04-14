# Mastodon Webhook Setup Guide

This guide explains how to configure the `account.approved` webhook in the Mastodon admin panel to integrate with the welcome bot.

## Prerequisites

### 1. Generate an Access Token for the Bot

Generate an access token using the account that will send welcome DMs (an admin account or a dedicated bot account).

1. In Mastodon web, go to **Preferences** > **Development** > **New Application**.
2. Configure the following:
   - **Application name**: `Welcome Bot` (choose any name)
   - **Permissions**: Check `write:statuses` (required to send DMs)
3. Click **Submit**.
4. On the created application's detail page, copy the **Access Token** value.
5. Set the copied token as `MASTODON_ACCESS_TOKEN` in your `.env` file.

### 2. Deploy the Bot Server

The bot server must have a publicly accessible URL.

- Example: `https://webhook.example.com/webhook`
- Using HTTPS is recommended (via a reverse proxy).

#### Nginx Reverse Proxy Setup

For detailed instructions on setting up Nginx as a reverse proxy, see the [Nginx Reverse Proxy Setup Guide](nginx-proxy-setup.en.md).

## Register the Webhook

### 1. Access the Admin Panel

Log in with a Mastodon admin account and navigate to **Administration** > **Webhooks**.

- URL: `https://<domain>/admin/webhooks`

### 2. Add a New Webhook

Click the **Add endpoint** button and enter the following:

| Field | Value | Description |
|-------|-------|-------------|
| **Endpoint URL** | `https://webhook.example.com/webhook` | The webhook receive URL of the bot server |
| **Events** | Check `account.approved` | Notify when an account is approved |
| **Secret** | (auto-generated) | Used for webhook signature verification |

### 3. Confirm the Secret Key

A secret key is automatically generated when the webhook is created.

1. View the **Secret** value on the created webhook's detail page.
2. Set this value as `WEBHOOK_SECRET` in your `.env` file.

> **Important**: The `WEBHOOK_SECRET` value in your `.env` file must exactly match the secret in the Mastodon admin panel. If they don't match, signature verification will fail and the webhook won't be processed.

## Webhook Payload Structure

Example payload sent by Mastodon when an `account.approved` event occurs:

```json
{
  "event": "account.approved",
  "created_at": "2024-01-15T10:30:00.000Z",
  "object": {
    "id": "12345",
    "username": "newuser",
    "domain": null,
    "created_at": "2024-01-15T10:00:00.000Z",
    "email": "newuser@example.com",
    "approved": true,
    "account": {
      "id": "12345",
      "username": "newuser",
      "acct": "newuser",
      "display_name": "New User",
      "url": "https://mastodon.example.com/@newuser"
    }
  }
}
```

The bot server extracts information such as `object.account.username`, `object.account.display_name`, `object.account.acct`, and `object.account.url` from this payload to compose the welcome message.

## Verification

### 1. Health Check

```bash
curl https://webhook.example.com/health
# Response: {"status":"ok"}
```

### 2. Check Server Logs

```bash
pm2 logs mastodon-welcome-bot
```

### 3. Testing

To do a real test, submit a new account registration on your Mastodon instance and approve it in the admin panel. Verify that a welcome DM is sent immediately upon approval.

You can also test by manually sending a webhook payload:

```bash
# Generate a signature using the secret
SECRET="your_webhook_secret_here"
PAYLOAD='{"event":"account.approved","created_at":"2024-01-15T10:30:00.000Z","object":{"id":"12345","username":"testuser","account":{"id":"12345","username":"testuser","acct":"testuser","display_name":"Test User","url":"https://mastodon.example.com/@testuser"}}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256=" $NF}')

# Send the webhook
curl -X POST https://webhook.example.com/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| `401 Invalid signature` | Secret mismatch | Verify that `WEBHOOK_SECRET` in `.env` matches the secret in the Mastodon admin panel |
| `500 Failed to send DM` | API token error | Check that `MASTODON_ACCESS_TOKEN` is valid and has `write:statuses` permission |
| Webhook not received | URL inaccessible | Check that the bot server is publicly accessible and review firewall settings |
| Webhook deactivated | Repeated failures | Mastodon automatically deactivates a webhook after repeated delivery failures. Re-enable it in the admin panel |
