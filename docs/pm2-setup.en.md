# PM2 Setup and Management Guide

This guide explains how to run the Mastodon Welcome Bot reliably in a production environment using PM2.

## 1. Install PM2

```bash
npm install -g pm2
```

## 2. Prepare the Project

```bash
# Navigate to the project directory
cd /path/to/mastodon-welcome-bot

# Install dependencies
npm install

# Configure the .env file
cp .env.example .env
# Edit the .env file and fill in the actual values
nano .env
```

## 3. Start the Server with PM2

### Start with ecosystem.config.json (recommended)

Use the `ecosystem.config.json` file included in the project root:

```bash
pm2 start ecosystem.config.json --env production
```

### Start directly

```bash
pm2 start src/index.js --name mastodon-welcome-bot
```

## 4. Common PM2 Commands

### Check Status

```bash
# List running processes
pm2 list

# Show detailed information
pm2 show mastodon-welcome-bot
```

### View Logs

```bash
# View real-time logs
pm2 logs mastodon-welcome-bot

# View the last 100 lines of logs
pm2 logs mastodon-welcome-bot --lines 100
```

### Manage the Server

```bash
# Restart
pm2 restart mastodon-welcome-bot

# Stop
pm2 stop mastodon-welcome-bot

# Delete (remove from process list)
pm2 delete mastodon-welcome-bot
```

### Restart After Changing Environment Variables

After editing the `.env` file, you must restart:

```bash
pm2 restart mastodon-welcome-bot
```

## 5. Auto-Start on Server Reboot

```bash
# Save the current list of running processes
pm2 save

# Generate a system startup script
pm2 startup

# Copy and run the outputted command (requires sudo)
# e.g.: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

With this configuration, the bot will start automatically even after the server reboots.

## 6. Monitoring

```bash
# Real-time dashboard
pm2 monit
```

## 7. Log Management

To prevent PM2 log files from growing too large, install `pm2-logrotate`:

```bash
pm2 install pm2-logrotate

# Set maximum log file size (default: 10MB)
pm2 set pm2-logrotate:max_size 10M

# Set number of log files to retain (default: 30)
pm2 set pm2-logrotate:retain 7
```
