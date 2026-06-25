import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const envFilePath = [`.env.${nodeEnv}`, '.env'];

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath,
      validate: validateEnv,
    }),
  ],
})
export class ConfigModule {}
