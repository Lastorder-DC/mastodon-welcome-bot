# Nginx 리버스 프록시 설정 가이드

Nginx를 리버스 프록시로 사용하여 마스토돈 웰컴 봇 서버를 외부에 안전하게 노출하는 방법을 설명합니다.

## 왜 리버스 프록시가 필요한가?

- **HTTPS 지원**: 마스토돈 웹훅은 HTTPS URL을 사용하는 것이 권장됩니다.
- **보안**: Node.js 서버를 직접 외부에 노출하지 않고, Nginx가 앞단에서 요청을 필터링합니다.
- **성능**: 정적 파일 서빙, 압축, 커넥션 관리 등을 Nginx가 효율적으로 처리합니다.

## 구성도

```
[마스토돈 서버] --HTTPS--> [Nginx :443] --HTTP--> [봇 서버 :3000]
```

## 1. Nginx 설치

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

## 2. SSL 인증서 준비

### Let's Encrypt (certbot) 사용 (권장)

```bash
# certbot 설치
sudo apt install certbot python3-certbot-nginx

# 인증서 발급
sudo certbot --nginx -d webhook.example.com

# 자동 갱신 확인
sudo certbot renew --dry-run
```

### 기존 인증서 사용

인증서 파일을 아래 경로에 준비합니다:

- 인증서: `/etc/ssl/certs/webhook.example.com.pem`
- 개인키: `/etc/ssl/private/webhook.example.com.key`

## 3. Nginx 설정 파일 작성

`/etc/nginx/sites-available/mastodon-welcome-bot` 파일을 생성합니다:

```nginx
# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    listen [::]:80;
    server_name webhook.example.com;

    # Let's Encrypt 인증서 갱신용
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS 서버
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name webhook.example.com;

    # SSL 인증서 설정
    ssl_certificate /etc/letsencrypt/live/webhook.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webhook.example.com/privkey.pem;

    # SSL 보안 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 보안 헤더
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # 요청 바디 크기 제한 (웹훅 페이로드용으로 충분)
    client_max_body_size 1m;

    # 리버스 프록시 설정
    location / {
        proxy_pass http://127.0.0.1:3000;

        # 프록시 헤더 전달
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # 타임아웃 설정
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # 버퍼 설정
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # 접근 및 에러 로그
    access_log /var/log/nginx/mastodon-welcome-bot.access.log;
    error_log /var/log/nginx/mastodon-welcome-bot.error.log;
}
```

## 4. 설정 활성화

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/mastodon-welcome-bot /etc/nginx/sites-enabled/

# 설정 파일 문법 검사
sudo nginx -t

# Nginx 재시작
sudo systemctl reload nginx
```

## 5. Express Trust Proxy 설정

Nginx 리버스 프록시 뒤에서 Express 서버를 실행할 경우, Express가 `X-Forwarded-For`, `X-Forwarded-Proto` 등의 헤더를 올바르게 인식하도록 **trust proxy**를 설정해야 합니다.

### trust proxy를 설정하지 않으면?

- `req.ip`가 항상 `127.0.0.1` (Nginx의 IP)로 표시됩니다.
- `req.protocol`이 항상 `http`로 인식됩니다 (실제로는 HTTPS인데도).
- 로그에 실제 클라이언트 IP가 기록되지 않습니다.

### .env 설정

`.env` 파일에서 `TRUSTED_PROXY` 값을 설정합니다:

```bash
# 같은 서버에서 Nginx를 실행하는 경우 (가장 일반적)
TRUSTED_PROXY=loopback

# 사설 네트워크 내 별도 서버에서 Nginx를 실행하는 경우
TRUSTED_PROXY=loopback,uniquelocal

# 특정 IP/서브넷만 신뢰
TRUSTED_PROXY=192.168.1.100

# 여러 프록시 IP를 지정
TRUSTED_PROXY=192.168.1.100,10.0.0.0/8

# 프록시 홉 수로 지정 (앞에서 N번째 프록시까지 신뢰)
TRUSTED_PROXY=1
```

### trust proxy 옵션 설명

| 값 | 설명 |
|-----|------|
| `loopback` | `127.0.0.1/8`, `::1/128` 루프백 주소를 신뢰 |
| `linklocal` | `169.254.0.0/16`, `fe80::/10` 링크 로컬 주소를 신뢰 |
| `uniquelocal` | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7` 사설 IP를 신뢰 |
| IP/서브넷 | 지정한 IP 또는 CIDR 서브넷을 신뢰 |
| 숫자 | 클라이언트에서부터 N번째 홉까지 신뢰 |
| `true` | 모든 프록시를 신뢰 (**보안상 권장하지 않음**) |

> **권장**: 같은 서버에서 Nginx를 실행하는 일반적인 구성에서는 `TRUSTED_PROXY=loopback`을 사용하세요.

## 6. 방화벽 설정

외부에서는 Nginx (80/443)만 접근 가능하도록 하고, 봇 서버 포트(3000)는 로컬에서만 접근 가능하도록 설정합니다.

### UFW (Ubuntu)

```bash
# Nginx 허용
sudo ufw allow 'Nginx Full'

# 봇 서버 포트는 외부에서 접근 차단 (기본적으로 차단되어 있음)
# 필요하면 명시적으로 차단:
sudo ufw deny 3000

sudo ufw enable
```

### firewalld (CentOS/RHEL)

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 7. 동작 확인

```bash
# HTTPS로 헬스체크
curl https://webhook.example.com/health
# 응답: {"status":"ok"}

# HTTP → HTTPS 리다이렉트 확인
curl -I http://webhook.example.com/health
# 응답: 301 Moved Permanently, Location: https://...
```

## 8. 마스토돈 서버와 같은 Nginx에서 운영하기

이미 마스토돈 서버용 Nginx가 실행 중이라면, 기존 Nginx에 서버 블록을 추가하는 것만으로 충분합니다.

### 마스토돈과 같은 도메인의 서브패스 사용

별도 도메인 없이 마스토돈 도메인의 서브패스로 설정할 수도 있습니다:

```nginx
# 기존 마스토돈 Nginx 설정에 추가
server {
    # ... 기존 마스토돈 설정 ...

    # 웰컴 봇 웹훅 경로
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

이 경우 마스토돈 웹훅 URL은 `https://mastodon.example.com/webhook`이 됩니다.

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `502 Bad Gateway` | 봇 서버가 실행되지 않음 | `pm2 list`로 봇 서버 상태 확인, `pm2 restart`로 재시작 |
| `504 Gateway Timeout` | 봇 서버 응답 지연 | 봇 서버 로그 확인, 마스토돈 API 연결 상태 점검 |
| SSL 인증서 오류 | 인증서 만료 또는 설정 오류 | `sudo certbot renew`로 갱신, `nginx -t`로 설정 확인 |
| `req.ip`가 `127.0.0.1`로 표시됨 | trust proxy 미설정 | `.env`에 `TRUSTED_PROXY=loopback` 설정 |
