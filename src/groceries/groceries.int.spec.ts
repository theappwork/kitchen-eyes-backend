import {INestApplication, ValidationPipe} from '@nestjs/common';
import {Test} from '@nestjs/testing';
import {FastifyAdapter, NestFastifyApplication} from '@nestjs/platform-fastify';
import {AppModule} from '../app.module';
import {GenericContainer, StartedTestContainer, Wait} from 'testcontainers';
import {DataSource} from 'typeorm';
import {execFileSync} from 'child_process';
import {ConfigService} from '@nestjs/config';
import {plainToInstance} from 'class-transformer';
import {PostgresConnectionOptions} from "typeorm/driver/postgres/PostgresConnectionOptions";

describe('GroceriesModule (integration)', () => {
    let app: (INestApplication & NestFastifyApplication) | undefined;
    let container: StartedTestContainer | undefined;
    let dataSource: DataSource | undefined;
    let baseUrl: string | undefined;

    beforeAll(async () => {
        // If DOCKER_HOST is not set, prefer Podman.
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
        dataSource = moduleRef.get(DataSource);
    });

    afterAll(async () => {
        if (app) await app.close();
        if (container) await container.stop();
    });

    function isoDate(daysOffset = 0) {
        const d = new Date();
        d.setDate(d.getDate() + daysOffset);
        return d.toISOString();
    }

    class Place {
        id!: string;
        name!: string
    }

    class Grocery {
        id!: string;
        name!: string;
        quantity!: number;
        place_id!: string;
    }

    it('POST /groceries then GET /groceries', async () => {
        // Fetch places and select FRIDGE
        const placesRes = await fetch(`${baseUrl}/places`);
        expect(placesRes.status).toBe(200);
        const places = plainToInstance(Place, (await placesRes.json()) as unknown as object[]);
        const fridge = places.find((p) => p.name === 'FRIDGE') as Place;
        expect(fridge).toBeDefined();

        const createDto = {
            name: 'Rice',
            quantity: 2,
            place_id: fridge.id,
            price: 10.5,
            price_per_kg: 3.5,
            date_bought: isoDate(),
        };

        const createRes = await fetch(`${baseUrl}/groceries`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify(createDto),
        });
        expect(createRes.status).toBe(201);

        const created = plainToInstance(Grocery, (await createRes.json()) as unknown as object) as Grocery;
        expect(created.id).toBeDefined();
        expect(created.name).toBe('Rice');
        expect(Number(created.quantity)).toBe(2);
        expect(created.place_id).toBe(fridge.id);

        const listRes = await fetch(`${baseUrl}/groceries`);
        expect(listRes.status).toBe(200);
        const body = await listRes.json();
        const list = plainToInstance(Grocery, body.items as unknown as object[]) as Grocery[];
        const got = list.find((g) => g.id === created.id);
        expect(got).toBeDefined();
        expect(body).toHaveProperty('nextCursor');
    });

    it('PUT /groceries updates grocery and appends price history', async () => {
        const placesRes = await fetch(`${baseUrl}/places`);
        expect(placesRes.status).toBe(200);
        const places = plainToInstance(Place, (await placesRes.json()) as unknown as object[]);
        const fridge = places.find((p) => p.name === 'FRIDGE') as Place;
        const cabinet = places.find((p) => p.name === 'CABINET') as Place;

        // Create grocery first
        const createRes = await fetch(`${baseUrl}/groceries`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({
                name: 'Beans',
                quantity: 1,
                place_id: fridge.id,
                price: 5,
                date_bought: isoDate(-1),
            }),
        });
        expect(createRes.status).toBe(201);
        const created = await createRes.json();

        // Update grocery
        const updateDto = {
            quantity: 3,
            place_id: cabinet.id,
            price: 4.75,
            date_bought: isoDate(),
        };

        const updateRes = await fetch(`${baseUrl}/groceries/${created.id}`, {
            method: 'PUT',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify(updateDto),
        });
        expect(updateRes.status).toBe(200);
        const updated = plainToInstance(Grocery, (await updateRes.json()) as unknown as object) as Grocery;

        expect(updated.id).toBe(created.id);
        expect(Number(updated.quantity)).toBe(3);
        expect(updated.place_id).toBe(cabinet.id);

        // Verify grocery has (2) price history records
        const schema = ((dataSource as DataSource).options as PostgresConnectionOptions).schema ?? 'kitchen-eyes';
        const [{count}] = await (dataSource as DataSource).query(
            `SELECT COUNT(*)::int as count
             FROM "${schema}".grocery_price_history
             WHERE grocery_id = $1`,
            [created.id],
        );
        expect(count).toBe(2);
    });
});
