import {INestApplication, ValidationPipe} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import {FastifyAdapter, NestFastifyApplication} from '@nestjs/platform-fastify';
import {AppModule} from '../app.module';
import {GenericContainer, StartedTestContainer, Wait} from 'testcontainers';
import {execFileSync} from 'child_process';
import {ConfigService} from '@nestjs/config';
import {plainToInstance} from 'class-transformer';

describe('PlacesModule (integration)', () => {
    let app: (INestApplication & NestFastifyApplication) | undefined;
    let container: StartedTestContainer | undefined;

    let baseUrl: string | undefined;

    beforeAll(async () => {
        // If DOCKER_HOST is not set, prefer Podman by querying its remote socket path.
        if (!process.env.DOCKER_HOST) {
            try {
                const out = execFileSync('podman', ['info', '--format', "{{.Host.RemoteSocket.Path}}"], {
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'ignore'],
                });
                const socketPath = out.trim();
                if (socketPath) {
                    process.env.DOCKER_HOST = `unix://${socketPath}`;
                    process.env.TESTCONTAINERS_CONTAINER_RUNTIME = 'podman';
                    process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';
                } else {
                    throw new Error('Podman remote socket path was empty or not found on the filesystem.');
                }
            } catch (err) {
                throw new Error(
                    "Podman is required for integration tests. Failed to determine Podman socket. Please set DOCKER_HOST to the Podman socket. For example:\n" +
                    "export DOCKER_HOST=unix://$(podman info --format '{{.Host.RemoteSocket.Path}}')\n" +
                    'Also consider: export TESTCONTAINERS_CONTAINER_RUNTIME=podman\n' +
                    `Original error: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }

        container = await new GenericContainer('postgres:14.18-alpine3.22')
            .withEnvironment({
                POSTGRES_DB: 'theappwork',
                POSTGRES_USER: 'postgres',
                POSTGRES_PASSWORD: 'postgres',
            })
            .withCopyDirectoriesToContainer([
                {
                    source: 'docker-entrypoint-initdb.d',
                    target: '/docker-entrypoint-initdb.d',
                }
            ])
            .withExposedPorts(5432)
            .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections'))
            .start();

        const dbConfig = {
            DB_HOST: container.getHost(),
            DB_PORT: String(container.getMappedPort(5432)),
            DB_USER: 'postgres',
            DB_PASSWORD: 'postgres',
            DB_NAME: 'theappwork',
            DB_SCHEMA: 'e2e',
            NODE_ENV: 'e2e',
        } as any;

        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(ConfigService)
            .useValue({
                get: (key: string, defaultValue?: any) => dbConfig[key] ?? process.env[key] ?? defaultValue,
            })
            .compile();

        app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
                transformOptions: {enableImplicitConversion: true},
            }),
        );
        await app.init();
        await app.listen(0, '127.0.0.1');
        baseUrl = await app.getUrl();
    });

    afterAll(async () => {
        if (app) await app.close();
        if (container) await container.stop();
    });

    class Place {
        id!: number;
        name!: string;
    }

    it('GET /places returns seeded places', async () => {
        const res = await fetch(`${baseUrl}/places`);
        expect(res.status).toBe(200);
        const body = plainToInstance(Place, (await res.json()) as unknown as object[]);
        const names = body.map((p) => p.name).sort();
        expect(names).toEqual(['CABINET', 'FRIDGE', 'FRUITS_BASKET'].sort());
    });
});
