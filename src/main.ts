import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from '@/common/filters/prisma-exception.filter';
import { ResponseInterceptor } from '@/common/interceptors/response.interceptor';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Docs
  const config = new DocumentBuilder()
    .setTitle('My API forever')
    .setDescription('My description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // Bảo mật HTTP headers
  app.use(helmet());

  // CORS — cho phép origin từ env (FE dev server hoặc production domain)
  app.enableCors({ origin: process.env.CORS_ORIGIN, credentials: true });

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());
  app.useGlobalPipes(new ZodValidationPipe());

  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
