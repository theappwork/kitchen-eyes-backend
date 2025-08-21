import {NestFactory} from '@nestjs/core';
import {AppModule} from './app.module';
import {FastifyAdapter, NestFastifyApplication} from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import {ValidationPipe} from '@nestjs/common';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    await app.register(helmet, {
        contentSecurityPolicy: false,
    });
    await app.register(cors, {origin: true});

    const swaggerConfig = new DocumentBuilder()
        .setTitle('Kitchen-Eyes API')
        .setDescription('API documentation for Kitchen-Eyes')
        .setVersion('1.0.0')
        .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('/docs', app, document, {
        jsonDocumentUrl: '/docs-json',
    });

    app.useGlobalPipes(new ValidationPipe({whitelist: true, transform: true}));

    await app.listen({port: Number(process.env.PORT ?? 3000), host: '0.0.0.0'});
}

bootstrap().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Failed to bootstrap application', e);
    process.exit(1);
});
