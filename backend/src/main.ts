import { ConfigService } from '@nestjs/config';
import { createApp } from './create-app';
import type { EnvConfig } from './common/config/env.validation';

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService<EnvConfig, true>);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Stallwart backend listening on :${port}`);
}

bootstrap();
