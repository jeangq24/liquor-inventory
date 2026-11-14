import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import figlet from 'figlet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
  const amarillo = '\x1b[33m';
  const reset = '\x1b[0m';

  const banner = figlet.textSync('LicoresYaaa - inventory', {
    horizontalLayout: 'controlled smushing',
  });

  console.log(`${amarillo}${banner}${reset}`);
}
await bootstrap();
