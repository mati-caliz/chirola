import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

const DEFAULT_PORT = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const trustedProxies = process.env["TRUST_PROXY"];
  if (trustedProxies !== undefined && trustedProxies !== "") {
    app.set("trust proxy", trustedProxies);
  }
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env["PORT"] ?? DEFAULT_PORT;
  await app.listen(port);
  new Logger("Bootstrap").log(`Chirola API escuchando en http://localhost:${port}/api`);
}
void bootstrap();
