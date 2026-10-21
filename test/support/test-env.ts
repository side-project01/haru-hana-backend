/**
 * e2e용 최소 환경변수. `AppModule`을 import하는 순간 ConfigModule(fail-fast)이 검증하므로
 * 테스트 파일보다 먼저 실행되는 Jest `setupFiles`에서 채운다. 실제 DB 접속은 없다.
 */
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
process.env.DIRECT_URL = 'postgresql://user:pass@localhost:5432/test';
process.env.COOKIE_SECRET = 'e2e-cookie-secret';
process.env.AUTH_TOKEN_SECRET = 'e2e-auth-token-secret';
process.env.GOOGLE_CLIENT_ID = 'e2e-google-client-id';
process.env.CRON_SECRET = 'e2e-cron-secret';
process.env.CORS_ORIGINS = 'http://localhost:5173';
