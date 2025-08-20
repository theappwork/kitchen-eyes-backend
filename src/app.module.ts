import {CacheInterceptor, CacheModule} from '@nestjs/cache-manager';
import {Module, OnModuleInit} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DataSource} from 'typeorm';
import {PlacesModule} from './places/places.module';
import {GroceriesModule} from './groceries/groceries.module';
import {Place} from './places/place.entity';
import {Grocery} from './groceries/grocery.entity';
import {GroceryPriceHistory} from './groceries-price-history/grocery-price-history.entity';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {Keyv} from 'keyv';
import {createKeyv} from '@keyv/redis';
import {CacheableMemory} from 'cacheable';
import {APP_INTERCEPTOR} from "@nestjs/core";
import {PostgresConnectionOptions} from "typeorm/driver/postgres/PostgresConnectionOptions";

@Module({
    imports: [
        ConfigModule.forRoot({isGlobal: true}),
        CacheModule.registerAsync({
            isGlobal: true,
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => {
                const REDIS_HOST = config.get<string>('REDIS_HOST', 'localhost');
                const REDIS_PORT = +config.get<number>('REDIS_PORT', 6379);
                const REDIS_USER = config.get<string>('REDIS_USER', '');
                const REDIS_PASSWORD = config.get<string>('REDIS_PASSWORD', 'securepassword');
                const CACHE_DEFAULT_TTL = config.get<number>('CACHE_DEFAULT_TTL', 60 * 60);
                return {
                    ttl: CACHE_DEFAULT_TTL,
                    stores: ['development', 'e2e'].includes(config.get<string>('NODE_ENV', 'development')) ? [] : [
                        new Keyv({
                            store: new CacheableMemory({ttl: CACHE_DEFAULT_TTL, lruSize: 5000}),
                        }),
                        createKeyv(`redis://${REDIS_USER}:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`)
                    ]
                }
            },
        }),
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => {
                const DB_HOST = config.get<string>('DB_HOST', 'localhost');
                const DB_PORT = config.get<number>('DB_PORT', 5432);
                const DB_USER = config.get<string>('DB_USER', 'postgres');
                const DB_PASSWORD = config.get<string>('DB_PASSWORD', 'postgres');
                const DB_NAME = config.get<string>('DB_NAME', 'theappwork');
                const DB_SCHEMA = config.get<string>('DB_SCHEMA', 'kitchen-eyes');
                return {
                    type: 'postgres',
                    host: DB_HOST,
                    port: DB_PORT,
                    username: DB_USER,
                    password: DB_PASSWORD,
                    database: DB_NAME,
                    schema: DB_SCHEMA,
                    entities: [Place, Grocery, GroceryPriceHistory],
                    // synchronize disabled, it runs later in 'dataSourceFactory'
                    synchronize: false,
                    logging: config.get<string>('NODE_ENV', 'development') === 'development',
                    environment: config.get<string>('NODE_ENV', 'development'),
                };
            },
            dataSourceFactory: async (options: any) => {
                const ds = new DataSource({...(options), synchronize: false});
                await ds.initialize();
                const schema = options.schema ?? 'kitchen-eyes';
                const owner = options.username ?? 'postgres';
                // ensure schema exists
                await ds
                    .query(`CREATE SCHEMA IF NOT EXISTS "${schema}" AUTHORIZATION ${owner};`)
                    .catch((e) => console.error('Failed to run script', e));
                if (['development', 'e2e'].includes(options.environment) ?? false) {
                    await ds.synchronize();
                }
                return ds;
            },
        }),
        PlacesModule,
        GroceriesModule,
    ],
    providers: [
        {
            provide: APP_INTERCEPTOR,
            useClass: CacheInterceptor,
        }
    ]
})
export class AppModule implements OnModuleInit {
    constructor(private dataSource: DataSource) {
    }

    // Seed 'places' if empty
    async onModuleInit() {
        const schema = (this.dataSource.options as PostgresConnectionOptions).schema ?? 'kitchen-eyes';
        const countRes = await this.dataSource
            .query(`SELECT COUNT(*)::int as count
                    FROM "${schema}".place;`)
            .catch(async () => [{count: 0}]);
        const count = Array.isArray(countRes) ? (countRes[0]?.count ?? 0) : 0;
        if (count === 0) {
            await this.dataSource
                .query(
                    `INSERT INTO "${schema}".place (name)
                     VALUES ($1),
                            ($2),
                            ($3)
                     ON CONFLICT DO NOTHING;`,
                    ['FRIDGE', 'CABINET', 'FRUITS_BASKET'],
                )
                .catch(() => undefined);
        }
    }
}
