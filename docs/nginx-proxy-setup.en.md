# Nginx Reverse Proxy Setup Guide

This guide explains how to use Nginx as a reverse proxy to safely expose the Mastodon Welcome Bot server to the internet.

## Why Do You Need a Reverse Proxy?

- **HTTPS support**: It is recommended to use an HTTPS URL for Mastodon webhooks.
- **Security**: Nginx sits in front and filters requests instead of exposing the Node.js server directly to the internet.
- **Performance**: Nginx efficiently handles static file serving, compression, and connection management.

## Architecture

```
[Mastodon Server] --HTTPS--> [Nginx :443] --HTTP--> [Bot Server :3000]
```

## 1. Install Nginx

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install nginx
```

### CentOS / RHEL

```bash
sudo yum install epel-release
sudo yum install nginx
```

## 2. Prepare an SSL Certificate

### Using Let's Encrypt (certbot) — Recommended

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Issue a certificate
sudo certbot --nginx -d webhook.example.com

# Verify automatic renewal
sudo certbot renew --dry-run
```

### Using an Existing Certificate

Prepare your certificate files at the following paths:

- Certificate: `/etc/ssl/certs/webhook.example.com.pem`
- Private key: `/etc/ssl/private/webhook.example.com.key`

## 3. Write the Nginx Configuration File

Create the file `/etc/nginx/sites-available/mastodon-welcome-bot`:

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name webhook.example.com;

    # For Let's Encrypt certificate renewal
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name webhook.example.com;

    # SSL certificate configuration
    ssl_certificate /etc/letsencrypt/live/webhook.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webhook.example.com/privkey.pem;

    # SSL security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # Request body size limit (sufficient for webhook payloads)
    client_max_body_size 1m;

    # Reverse proxy configuration
    location / {
        proxy_pass http://127.0.0.1:3000;

        # Pass proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Timeout settings
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Access and error logs
    access_log /var/log/nginx/mastodon-welcome-bot.access.log;
    error_log /var/log/nginx/mastodon-welcome-bot.error.log;
}
```

## 4. Enable the Configuration

```bash
# Create a symbolic link
sudo ln -s /etc/nginx/sites-available/mastodon-welcome-bot /etc/nginx/sites-enabled/

# Test the configuration file syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## 5. Express Trust Proxy Configuration

When running the Express server behind an Nginx reverse proxy, you must configure **trust proxy** so that Express correctly recognizes headers such as `X-Forwarded-For` and `X-Forwarded-Proto`.

### What Happens Without Trust Proxy?

- `req.ip` always shows `127.0.0.1` (Nginx's IP).
- `req.protocol` is always recognized as `http` (even when the actual connection is HTTPS).
- Real client IPs are not recorded in logs.

### .env Configuration

Set the `TRUSTED_PROXY` value in your `.env` file:

```bash
# When Nginx runs on the same server (most common case)
TRUSTED_PROXY=loopback

# When Nginx runs on a separate server in a private network
TRUSTED_PROXY=loopback,uniquelocal

# Trust only a specific IP/subnet
TRUSTED_PROXY=192.168.1.100

# Specify multiple proxy IPs
TRUSTED_PROXY=192.168.1.100,10.0.0.0/8

# Specify by number of proxy hops (trust up to N hops from the client)
TRUSTED_PROXY=1
```

### Trust Proxy Option Descriptions

| Value | Description |
|-------|-------------|
| `loopback` | Trust loopback addresses: `127.0.0.1/8`, `::1/128` |
| `linklocal` | Trust link-local addresses: `169.254.0.0/16`, `fe80::/10` |
| `uniquelocal` | Trust private IPs: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7` |
| IP/subnet | Trust the specified IP or CIDR subnet |
| Number | Trust up to N hops from the client |
| `true` | Trust all proxies (**not recommended for security reasons**) |

> **Recommendation**: For the common setup where Nginx runs on the same server, use `TRUSTED_PROXY=loopback`.

## 6. Firewall Configuration

Allow only Nginx (80/443) from the outside and restrict access to the bot server port (3000) to local only.

### UFW (Ubuntu)

```bash
# Allow Nginx
sudo ufw allow 'Nginx Full'

# Block external access to the bot server port (blocked by default)
# Explicitly block if needed:
sudo ufw deny 3000

sudo ufw enable
```

### firewalld (CentOS/RHEL)

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 7. Verify the Setup

```bash
# Health check over HTTPS
curl https://webhook.example.com/health
# Response: {"status":"ok"}

# Verify HTTP → HTTPS redirect
curl -I http://webhook.example.com/health
# Response: 301 Moved Permanently, Location: https://...
```

## 8. Running on the Same Nginx as the Mastodon Server

If a Mastodon server Nginx is already running, you only need to add a server block to the existing Nginx configuration.

### Using a Sub-path of the Same Mastodon Domain

You can also configure it as a sub-path of the Mastodon domain without a separate domain:

```nginx
# Add to the existing Mastodon Nginx configuration
server {
    # ... existing Mastodon configuration ...

    # Welcome bot webhook path
    location /webhook {
        proxy_pass http://127.0.0.1:3000/webhook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /webhook/health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

In this case, the Mastodon webhook URL will be `https://mastodon.example.com/webhook`.

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| `502 Bad Gateway` | Bot server is not running | Check bot server status with `pm2 list`, restart with `pm2 restart` |
| `504 Gateway Timeout` | Bot server response delay | Check bot server logs, inspect Mastodon API connection status |
| SSL certificate error | Certificate expired or misconfigured | Renew with `sudo certbot renew`, verify configuration with `nginx -t` |
| `req.ip` shows `127.0.0.1` | Trust proxy not configured | Set `TRUSTED_PROXY=loopback` in `.env` |
