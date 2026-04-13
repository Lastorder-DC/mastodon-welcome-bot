# PM2 설정 및 관리 가이드

PM2를 사용하여 마스토돈 웰컴 봇을 프로덕션 환경에서 안정적으로 운영하는 방법을 설명합니다.

## 1. PM2 설치

```bash
npm install -g pm2
```

## 2. 프로젝트 준비

```bash
# 프로젝트 디렉토리로 이동
cd /path/to/mastodon-welcome-bot

# 의존성 설치
npm install

# .env 파일 설정
cp .env.example .env
# .env 파일을 편집하여 실제 값을 입력합니다
nano .env
```

## 3. PM2로 서버 시작

### ecosystem.config.json을 이용한 시작 (권장)

프로젝트 루트에 포함된 `ecosystem.config.json` 파일을 사용합니다:

```bash
pm2 start ecosystem.config.json --env production
```

### 직접 시작

```bash
pm2 start src/index.js --name mastodon-welcome-bot
```

## 4. 주요 PM2 명령어

### 상태 확인

```bash
# 실행 중인 프로세스 목록
pm2 list

# 상세 정보
pm2 show mastodon-welcome-bot
```

### 로그 확인

```bash
# 실시간 로그 보기
pm2 logs mastodon-welcome-bot

# 최근 100줄 로그 보기
pm2 logs mastodon-welcome-bot --lines 100
```

### 서버 관리

```bash
# 재시작
pm2 restart mastodon-welcome-bot

# 중지
pm2 stop mastodon-welcome-bot

# 삭제 (프로세스 목록에서 제거)
pm2 delete mastodon-welcome-bot
```

### 환경변수 변경 후 재시작

`.env` 파일을 수정한 후에는 반드시 재시작해야 합니다:

```bash
pm2 restart mastodon-welcome-bot
```

## 5. 서버 재부팅 시 자동 시작 설정

```bash
# 현재 실행 중인 프로세스 목록을 저장
pm2 save

# 시스템 시작 스크립트 생성
pm2 startup

# 출력되는 명령어를 복사하여 실행합니다 (sudo 권한 필요)
# 예: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

이 설정을 하면 서버가 재부팅되어도 봇이 자동으로 시작됩니다.

## 6. 모니터링

```bash
# 실시간 대시보드
pm2 monit
```

## 7. 로그 관리

PM2 로그 파일이 너무 커지는 것을 방지하려면 `pm2-logrotate`를 설치합니다:

```bash
pm2 install pm2-logrotate

# 로그 파일 최대 크기 설정 (기본: 10MB)
pm2 set pm2-logrotate:max_size 10M

# 보관할 로그 파일 수 설정 (기본: 30)
pm2 set pm2-logrotate:retain 7
```
