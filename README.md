# mastodon-welcome-bot

마스토돈 `account.approved` 웹훅을 이용하여 새로 승인된 사용자에게 환영 DM을 자동으로 발송하는 Node.js 서버입니다.

## 주요 기능

- 마스토돈 웹훅(`account.approved`) 수신 및 서명 검증
- 새로 승인된 사용자에게 자동 환영 DM 발송
- `.env` 기반 환경 설정 (도메인, OAuth 토큰, 메시지 템플릿)
- 메시지 템플릿 변수 치환 지원 (`{{username}}`, `{{display_name}}`, `{{domain}}`, `{{url}}`)

## 빠른 시작

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 실제 값을 입력합니다

# 서버 시작
npm start
```

## 환경변수 설정

| 변수 | 설명 | 예시 |
|------|------|------|
| `MASTODON_DOMAIN` | 마스토돈 서버 도메인 | `mastodon.social` |
| `MASTODON_ACCESS_TOKEN` | OAuth 액세스 토큰 (`write:statuses` 권한 필요) | `AbCdEf123...` |
| `WEBHOOK_SECRET` | 웹훅 시크릿 키 | `a1b2c3d4e5...` |
| `WELCOME_MESSAGE` | 환영 메시지 템플릿 | `안녕하세요 {{display_name}}님!` |
| `PORT` | 서버 포트 (기본: 3000) | `3000` |

### 메시지 템플릿 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `{{username}}` | 사용자 이름 | `alice` |
| `{{display_name}}` | 표시 이름 | `Alice Kim` |
| `{{domain}}` | 서버 도메인 | `mastodon.example.com` |
| `{{url}}` | 프로필 URL | `https://mastodon.example.com/@alice` |

## 문서

- [PM2 설정 및 관리 가이드](docs/pm2-setup.md)
- [마스토돈 웹훅 설정 가이드](docs/webhook-setup.md)

## 라이선스

MIT
