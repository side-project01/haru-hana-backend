import { validateEnv } from './env.validation';

describe('validateEnv — FIREBASE_SERVICE_ACCOUNT', () => {
  const serviceAccount = {
    type: 'service_account',
    project_id: 'haru-hana-test',
    client_email: 'firebase-adminsdk@haru-hana-test.iam.gserviceaccount.com',
    private_key:
      '-----BEGIN PRIVATE KEY-----\nSECRET\n-----END PRIVATE KEY-----\n',
  };
  const base = {
    DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
    DIRECT_URL: 'postgresql://user:pw@localhost:5432/db',
    COOKIE_SECRET: 'cookie',
    AUTH_TOKEN_SECRET: 'auth',
    GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com',
    CRON_SECRET: 'cron',
    CORS_ORIGINS: 'http://localhost:5173',
  };

  it('JSON 키를 firebase-admin cert()가 받는 객체로 바꾼다', () => {
    const env = validateEnv({
      ...base,
      FIREBASE_SERVICE_ACCOUNT: JSON.stringify(serviceAccount),
    });

    expect(env.FIREBASE_SERVICE_ACCOUNT).toEqual({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    });
  });

  it('JSON이 아니면 부팅 때 실패하고, 에러에 값을 싣지 않는다', () => {
    const broken = `{"private_key":"SECRET"`;

    expect(() =>
      validateEnv({ ...base, FIREBASE_SERVICE_ACCOUNT: broken }),
    ).toThrow('FIREBASE_SERVICE_ACCOUNT가 올바른 JSON이 아닙니다');
    expect(() =>
      validateEnv({ ...base, FIREBASE_SERVICE_ACCOUNT: broken }),
    ).not.toThrow(/SECRET/);
  });

  it('필수 필드가 빠지면 어떤 필드인지 알려 준다', () => {
    expect(() =>
      validateEnv({
        ...base,
        FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
          ...serviceAccount,
          private_key: undefined,
        }),
      }),
    ).toThrow('FIREBASE_SERVICE_ACCOUNT.private_key');
  });
});
