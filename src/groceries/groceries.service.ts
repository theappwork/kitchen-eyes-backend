import {Inject, Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, Repository} from 'typeorm';
import {Grocery} from './grocery.entity';
import {Place} from '../places/place.entity';
import {GroceryPriceHistory} from '../groceries-price-history/grocery-price-history.entity';
import {CreateGroceryDto} from './dto/create-grocery.dto';
import {UpdateGroceryDto} from './dto/update-grocery.dto';
import {GroceryDto, ListGroceriesDto} from './dto/grocery.dto';
import {PlaceNotFoundException} from '../places/exceptions/place-not-found.exception';
import {GroceryNotFoundException} from './exceptions/grocery-not-found.exception';
import {Cache, CACHE_MANAGER} from "@nestjs/cache-manager";
import {GroceryPriceHistoryDto} from "../groceries-price-history/dto/grocery-price-history.dto";
import {GroceryNotUniqueNameException} from "./exceptions/grocery-not-unique-name.exception";
import {FindGroceriesQueryDto} from "./dto/find-groceries.query";

@Injectable()
export class GroceriesService {
    static readonly CACHE_GET_ALL_KEY = 'groceries:all';
    static readonly CACHE_HISTORY_KEY = 'groceries:history:$id';

    private readonly logger = new Logger(GroceriesService.name, {timestamp: true})

    constructor(
        private dataSource: DataSource,
        @InjectRepository(Grocery) private groceriesRepo: Repository<Grocery>,
        @InjectRepository(Place) private placesRepo: Repository<Place>,
        @InjectRepository(GroceryPriceHistory)
        private historyRepo: Repository<GroceryPriceHistory>,
        @Inject(CACHE_MANAGER) private cache: Cache,
    ) {
    }

    async findAll(query?: FindGroceriesQueryDto): Promise<ListGroceriesDto> {
        const limit = Math.min(Math.max(query?.limit ?? 20, 1), 100);
        const qb = this.groceriesRepo
            .createQueryBuilder('g')
            .orderBy('g.name', 'ASC')
            .addOrderBy('g.id', 'ASC');

        if (query && !Object.keys(query).length) {
            const groceries = await this.groceriesRepo.find({order: {name: 'ASC'}, take: limit + 1}); // fetch one extra to know if there is a next page
            // default next cursor
            const hasMore = groceries.length > limit;
            const pageItems = hasMore ? groceries.slice(0, limit) : groceries;
            let nextCursor: string | null = null;
            if (hasMore && pageItems.length > 0) {
                const last = pageItems[pageItems.length - 1];
                try {
                    nextCursor = Buffer.from(JSON.stringify({name: last.name, id: last.id}), 'utf8').toString('base64');
                } catch (e) {
                    this.logger.warn(`Failed to build next cursor: ${e}`);
                    nextCursor = null;
                }
            }

            return ListGroceriesDto.of(groceries, nextCursor);
        }

        if (query?.name) {
            qb.andWhere('g.name ILIKE :name', {name: `%${query.name}%`});
        }
        if (query?.place) {
            qb.andWhere('g.place_id = :place', {place: query.place});
        }

        if (query?.cursor) {
            try {
                const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
                const {name, id} = JSON.parse(decoded) as { name: string; id: string };

                qb.andWhere('(g.name > :cName) OR (g.name = :cName AND g.id > :cId)', {cName: name, cId: id});
            } catch {
                this.logger.warn('Invalid cursor provided; ignoring');
            }
        }

        // fetch one extra to know if there is a next page
        qb.limit(limit + 1);
        const rows = await qb.getMany();
        const hasMore = rows.length > limit;
        const pageItems = hasMore ? rows.slice(0, limit) : rows;
        let nextCursor: string | null = null;
        if (hasMore && pageItems.length > 0) {
            const last = pageItems[pageItems.length - 1];
            try {
                nextCursor = Buffer.from(JSON.stringify({name: last.name, id: last.id}), 'utf8').toString('base64');
            } catch (e) {
                this.logger.warn(`Failed to build next cursor: ${e}`);
                nextCursor = null;
            }
        }
        return ListGroceriesDto.of(pageItems, nextCursor);
    }

    async history(groceryId: string): Promise<GroceryPriceHistoryDto[]> {
        const cachedValue = await this.cache.get(GroceriesService.CACHE_HISTORY_KEY.replace('$id', groceryId));
        if (cachedValue) return cachedValue as GroceryPriceHistoryDto[];

        const history = await this.historyRepo.find({where: {grocery: {id: groceryId}}, order: {date_bought: 'DESC'}});
        return GroceryPriceHistoryDto.fromEntities(history);
    }

    async create(dto: CreateGroceryDto): Promise<GroceryDto> {
        return this.dataSource.transaction(async (manager) => {
            const place = await manager.findOne(Place, {where: {id: dto.place_id}});
            if (!place) throw new PlaceNotFoundException();

            const grocery = new Grocery();
            grocery.name = dto.name;
            grocery.quantity = dto.quantity;
            grocery.place = Promise.resolve(place);

            let saved: Grocery;
            try {
                saved = await manager.save(grocery);
            } catch (e: any) {
                throw new GroceryNotUniqueNameException();
            }

            const history = new GroceryPriceHistory();
            history.grocery = Promise.resolve(saved);
            history.price = dto.price;
            history.price_per_kg = dto.price_per_kg ?? null;
            history.date_bought = new Date(dto.date_bought);

            await manager.save(history);
            await this.cache.del(GroceriesService.CACHE_GET_ALL_KEY);
            await this.cache.del(GroceriesService.CACHE_HISTORY_KEY.replace('$id', saved.id));
            return GroceryDto.fromEntity(saved);
        });
    }

    async update(id: string, dto: UpdateGroceryDto): Promise<GroceryDto> {
        return this.dataSource.transaction(async (manager) => {
            const place = await manager.findOne(Place, {where: {id: dto.place_id}});
            if (!place) throw new PlaceNotFoundException();

            const grocery = await manager.findOne(Grocery, {where: {id: id}});
            if (!grocery) throw new GroceryNotFoundException();

            grocery.quantity = dto.quantity;
            grocery.place = Promise.resolve(place);
            const saved = await manager.save(grocery);

            // Fetch the latest history to compare prices
            const history = await manager.findOne(GroceryPriceHistory, {
                where: {grocery: {id: grocery.id}},
                order: {date_bought: 'DESC'}
            });
            if (history) {
                const {price: prevPrice, price_per_kg: prevPerKg} = history;
                const priceChanged = prevPrice !== dto.price;
                const perKgChanged = (prevPerKg ?? null) !== (dto.price_per_kg ?? null);

                this.logger.debug(`Previous history: ${JSON.stringify({price: prevPrice, price_per_kg: prevPerKg})}`);
                this.logger.debug(`New history: ${JSON.stringify({price: dto.price, price_per_kg: dto.price_per_kg})}`);

                if (priceChanged || perKgChanged) {
                    this.logger.log('Either price or price_per_kg changed; creating new history entry');

                    const history = new GroceryPriceHistory()
                    history.grocery = Promise.resolve(saved);
                    history.price = dto.price;
                    history.price_per_kg = dto.price_per_kg ?? null;
                    history.date_bought = new Date(dto.date_bought);
                    await manager.save(history);
                }
            }

            await this.cache.del(GroceriesService.CACHE_GET_ALL_KEY);
            await this.cache.del(GroceriesService.CACHE_HISTORY_KEY.replace('$id', saved.id));
            return GroceryDto.fromEntity(saved);
        });
    }
}
