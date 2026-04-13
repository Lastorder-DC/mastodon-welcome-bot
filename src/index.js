require('dotenv').config();

const crypto = require('crypto');
const express = require('express');

const app = express();

const {
  MASTODON_DOMAIN,
  MASTODON_ACCESS_TOKEN,
  WEBHOOK_SECRET,
  WELCOME_MESSAGE,
  PORT = '3000',
  TRUSTED_PROXY,
} = process.env;

// 필수 환경변수 검증
const requiredEnvVars = {
  MASTODON_DOMAIN,
  MASTODON_ACCESS_TOKEN,
  WEBHOOK_SECRET,
  WELCOME_MESSAGE,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    console.error(`환경변수 ${key}가 설정되지 않았습니다. .env 파일을 확인해주세요.`);
    process.exit(1);
  }
}

/**
 * 메시지 템플릿의 {{변수}}를 실제 값으로 치환합니다.
 * @param {string} template - 메시지 템플릿
 * @param {Record<string, string>} variables - 치환할 변수 맵
 * @returns {string} 치환된 메시지
 */
function renderTemplate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match;
  });
}

/**
 * X-Hub-Signature를 검증합니다.
 * @param {Buffer} payload - 요청 바디 (raw)
 * @param {string} signature - X-Hub-Signature 헤더 값
 * @returns {boolean} 서명 유효 여부
 */
function verifySignature(payload, signature) {
  if (!signature) return false;

  const expected = `sha256=${crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

/**
 * 마스토돈 API를 통해 DM(다이렉트 메시지)을 전송합니다.
 * @param {string} acct - 대상 사용자 계정 (예: alice)
 * @param {string} message - 전송할 메시지 본문
 */
async function sendDirectMessage(acct, message) {
  const status = `@${acct} ${message}`;
  const apiUrl = `https://${MASTODON_DOMAIN}/api/v1/statuses`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status,
      visibility: 'direct',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `마스토돈 API 오류 (${response.status}): ${errorBody}`
    );
  }

  return response.json();
}

// trust proxy 설정 (리버스 프록시 사용 시)
if (TRUSTED_PROXY) {
  // 쉼표로 구분된 값, 숫자(홉 수), 또는 단일 값을 지원
  const value = TRUSTED_PROXY.trim();
  if (/^\d+$/.test(value)) {
    app.set('trust proxy', parseInt(value, 10));
  } else if (value === 'true') {
    app.set('trust proxy', true);
  } else {
    // 쉼표로 구분된 IP/서브넷 또는 'loopback', 'linklocal', 'uniquelocal'
    const proxies = value.split(',').map((s) => s.trim());
    app.set('trust proxy', proxies.length === 1 ? proxies[0] : proxies);
  }
  console.log(`trust proxy 설정: ${value}`);
}

// raw body를 버퍼로 보존하면서 JSON 파싱
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// 헬스체크 엔드포인트
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 웹훅 수신 엔드포인트
app.post('/webhook', async (req, res) => {
  // 서명 검증
  const signature = req.headers['x-hub-signature'];
  if (!verifySignature(req.rawBody, signature)) {
    console.warn('웹훅 서명 검증 실패');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, object } = req.body;

  // account.approved 이벤트만 처리
  if (event !== 'account.approved') {
    console.log(`이벤트 무시: ${event}`);
    return res.status(200).json({ status: 'ignored' });
  }

  // object에서 사용자 정보 추출
  const username = object?.account?.username || object?.username || '';
  const displayName =
    object?.account?.display_name || object?.account?.username || username;
  const acct = object?.account?.acct || username;
  const url = object?.account?.url || `https://${MASTODON_DOMAIN}/@${username}`;

  if (!username) {
    console.error('웹훅 페이로드에서 사용자 정보를 찾을 수 없습니다:', JSON.stringify(req.body));
    return res.status(400).json({ error: 'Missing user info' });
  }

  // 메시지 템플릿 렌더링
  const message = renderTemplate(WELCOME_MESSAGE, {
    username,
    display_name: displayName,
    domain: MASTODON_DOMAIN,
    url,
  });

  // \n 이스케이프 시퀀스를 실제 줄바꿈으로 변환
  const formattedMessage = message.replace(/\\n/g, '\n');

  try {
    const result = await sendDirectMessage(acct, formattedMessage);
    console.log(`환영 DM 전송 완료: @${acct} (status id: ${result.id})`);
    return res.status(200).json({ status: 'ok', statusId: result.id });
  } catch (error) {
    console.error(`환영 DM 전송 실패 (@${acct}):`, error.message);
    return res.status(500).json({ error: 'Failed to send DM' });
  }
});

app.listen(PORT, () => {
  console.log(`마스토돈 웰컴 봇 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`웹훅 URL: http://localhost:${PORT}/webhook`);
});
