import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Habilitar prefijo /api
  app.setGlobalPrefix('api');

  // Habilitar CORS para permitir conexión desde el frontend en Angular
  app.enableCors({
    origin: '*', // En producción limitar al dominio real de Angular
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Validaciones globales de DTOs
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  const port = process.env.PORT ?? 3000;
  console.log(`[Bootstrap] Servidor corriendo en puerto: http://localhost:${port}/api`);
  await app.listen(port);
}
bootstrap();
