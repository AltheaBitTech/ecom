import { AppConfig } from './common/config/app-config';
import { createApp } from './create-app';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get(AppConfig);

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.warn(`ecom backend listening on :${config.port} (${config.appEnv})`);
}

void bootstrap();
