# 마스토돈 웹훅 설정 가이드

마스토돈 관리자 패널에서 `account.approved` 웹훅을 설정하여 웰컴 봇과 연동하는 방법을 설명합니다.

## 사전 준비

### 1. 봇용 액세스 토큰 생성

웰컴 DM을 발송할 계정(관리 계정 또는 봇 전용 계정)으로 액세스 토큰을 생성합니다.

1. 마스토돈 웹에서 **설정** > **개발** > **새 애플리케이션** 으로 이동합니다.
2. 다음과 같이 설정합니다:
   - **애플리케이션 이름**: `Welcome Bot` (자유롭게 설정)
   - **권한**: `write:statuses` 체크 (DM 전송에 필요)
3. **제출** 을 클릭합니다.
4. 생성된 애플리케이션 상세 페이지에서 **액세스 토큰** 값을 복사합니다.
5. 복사한 토큰을 `.env` 파일의 `MASTODON_ACCESS_TOKEN`에 설정합니다.

### 2. 봇 서버 배포

봇 서버가 외부에서 접근 가능한 URL을 가지고 있어야 합니다.

- 예: `https://webhook.example.com/webhook`
- HTTPS를 사용하는 것을 권장합니다 (리버스 프록시 사용).

#### Nginx 리버스 프록시 설정

Nginx를 리버스 프록시로 사용하는 상세한 설정 방법은 [Nginx 리버스 프록시 설정 가이드](nginx-proxy-setup.md)를 참고하세요.

## 웹훅 등록

### 1. 관리자 패널 접속

마스토돈 관리자 계정으로 로그인한 후 **관리** > **웹훅** 페이지로 이동합니다.

- URL: `https://<도메인>/admin/webhooks`

### 2. 새 웹훅 추가

**엔드포인트 추가** 버튼을 클릭하고 다음을 입력합니다:

| 항목 | 값 | 설명 |
|------|-----|------|
| **엔드포인트 URL** | `https://webhook.example.com/webhook` | 봇 서버의 웹훅 수신 URL |
| **이벤트** | `account.approved` 체크 | 계정 승인 시 알림 |
| **시크릿** | (자동 생성됨) | 웹훅 서명 검증에 사용 |

### 3. 시크릿 키 확인

웹훅을 생성하면 시크릿 키가 자동으로 생성됩니다.

1. 생성된 웹훅의 상세 페이지에서 **시크릿** 값을 확인합니다.
2. 이 값을 `.env` 파일의 `WEBHOOK_SECRET`에 설정합니다.

> **중요**: `.env` 파일의 `WEBHOOK_SECRET` 값이 마스토돈 관리자 패널의 시크릿과 정확히 일치해야 합니다. 일치하지 않으면 서명 검증에 실패하여 웹훅이 처리되지 않습니다.

## 웹훅 페이로드 구조

`account.approved` 이벤트 발생 시 마스토돈이 전송하는 페이로드 예시입니다:

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

봇 서버는 이 페이로드에서 `object.account.username`, `object.account.display_name`, `object.account.acct`, `object.account.url` 등의 정보를 추출하여 환영 메시지를 생성합니다.

## 동작 확인

### 1. 헬스체크

```bash
curl https://webhook.example.com/health
# 응답: {"status":"ok"}
```

### 2. 서버 로그 확인

```bash
pm2 logs mastodon-welcome-bot
```

### 3. 테스트

실제 테스트를 하려면 마스토돈 인스턴스에서 새 계정을 가입 신청하고 관리자 패널에서 승인합니다. 승인 즉시 환영 DM이 발송되는지 확인합니다.

수동으로 웹훅 페이로드를 전송하여 테스트할 수도 있습니다:

```bash
# 시크릿으로 서명 생성
SECRET="your_webhook_secret_here"
PAYLOAD='{"event":"account.approved","created_at":"2024-01-15T10:30:00.000Z","object":{"id":"12345","username":"testuser","account":{"id":"12345","username":"testuser","acct":"testuser","display_name":"Test User","url":"https://mastodon.example.com/@testuser"}}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256=" $NF}')

# 웹훅 전송
curl -X POST https://webhook.example.com/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| `401 Invalid signature` | 시크릿 불일치 | `.env`의 `WEBHOOK_SECRET`과 마스토돈 관리자 패널의 시크릿이 일치하는지 확인 |
| `500 Failed to send DM` | API 토큰 오류 | `MASTODON_ACCESS_TOKEN`이 유효한지, `write:statuses` 권한이 있는지 확인 |
| 웹훅이 수신되지 않음 | URL 접근 불가 | 봇 서버가 외부에서 접근 가능한지, 방화벽 설정을 확인 |
| 웹훅이 비활성화됨 | 연속 실패 | 마스토돈은 웹훅 전송이 반복적으로 실패하면 자동으로 비활성화합니다. 관리자 패널에서 다시 활성화하세요 |
