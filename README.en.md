# mastodon-welcome-bot

A Node.js server that automatically sends a welcome DM to newly approved users via the Mastodon `account.approved` webhook.

## Features

- Receives and verifies Mastodon webhook (`account.approved`) signatures
- Automatically sends a welcome DM to newly approved users
- `.env`-based configuration (domain, OAuth token, message template)
- Message template variable substitution (`{{username}}`, `{{display_name}}`, `{{domain}}`, `{{url}}`)

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit the .env file and fill in the actual values

# Start the server
npm start
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MASTODON_DOMAIN` | Mastodon server domain | `mastodon.social` |
| `MASTODON_ACCESS_TOKEN` | OAuth access token (requires `write:statuses` permission) | `AbCdEf123...` |
| `WEBHOOK_SECRET` | Webhook secret key | `a1b2c3d4e5...` |
| `WELCOME_MESSAGE` | Welcome message template | `Hello {{display_name}}!` |
| `PORT` | Server port (default: 3000) | `3000` |
| `TRUSTED_PROXY` | Trust Proxy setting (when using a reverse proxy) | `loopback` |

### Message Template Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{username}}` | Username | `alice` |
| `{{display_name}}` | Display name | `Alice Kim` |
| `{{domain}}` | Server domain | `mastodon.example.com` |
| `{{url}}` | Profile URL | `https://mastodon.example.com/@alice` |

## Documentation

- [PM2 Setup and Management Guide](docs/pm2-setup.en.md)
- [Mastodon Webhook Setup Guide](docs/webhook-setup.en.md)
- [Nginx Reverse Proxy Setup Guide](docs/nginx-proxy-setup.en.md)

## License

MIT
