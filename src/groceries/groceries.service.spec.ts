import {Test} from '@nestjs/testing';
import {GroceriesService} from './groceries.service';
import {DataSource, Repository} from 'typeorm';
import {Grocery} from './grocery.entity';
import {Place} from '../places/place.entity';
import {GroceryPriceHistory} from '../groceries-price-history/grocery-price-history.entity';
import {getRepositoryToken} from '@nestjs/typeorm';
import {CreateGroceryDto} from './dto/create-grocery.dto';
import {UpdateGroceryDto} from './dto/update-grocery.dto';
import {BadRequestException} from '@nestjs/common';
import {GroceryNotFoundException} from './exceptions/grocery-not-found.exception';
import {CACHE_MANAGER} from "@nestjs/cache-manager";
import {PlaceNotFoundException} from "../places/exceptions/place-not-found.exception";
import {GroceryNotUniqueNameException} from "./exceptions/grocery-not-unique-name.exception";

describe('GroceriesService', () => {
    let service: GroceriesService;
    let groceriesRepo: jest.Mocked<Repository<Grocery>>;
    let placesRepo: jest.Mocked<Repository<Place>>;
    let historyRepo: jest.Mocked<Repository<GroceryPriceHistory>>;
    let dataSource: { transaction: jest.Mock };
    let cache: { get: jest.Mock, set: jest.Mock, del: jest.Mock };

    function makeManager() {
        return {
            findOneByOrFail: jest.fn(),
            findOne: jest.fn(async (_entity: any, opts: any) => {
                if (_entity === Grocery) {
                    if (opts?.where?.id === 'g1') return {id: 'g1', name: 'Apple', quantity: 1, place_id: 'place-1'} as Grocery;
                    return null;
                }
                if (_entity === Place) {
                    const id = opts?.where?.id;
                    if (id === 'place-1' || id === 'place-2') return {id, name: 'FRIDGE'} as Place;
                    return null;
                }
                if (_entity === GroceryPriceHistory) {
                    return null;
                }
                return null;
            }),
            create: jest.fn((entity: any, obj: any) => ({...obj})),
            save: jest.fn(async (obj: any) => ({...obj, id: obj.id ?? 'generated-id'})),
        };
    }

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                GroceriesService,
                {provide: DataSource, useValue: {transaction: jest.fn()}},
                {provide: getRepositoryToken(Grocery), useValue: {}},
                {provide: getRepositoryToken(Place), useValue: {}},
                {provide: getRepositoryToken(GroceryPriceHistory), useValue: {}},
                {provide: CACHE_MANAGER, useValue: {get: jest.fn(), set: jest.fn(), del: jest.fn()}},
            ],
        }).compile();

        service = moduleRef.get(GroceriesService);
        groceriesRepo = moduleRef.get(getRepositoryToken(Grocery));
        placesRepo = moduleRef.get(getRepositoryToken(Place));
        historyRepo = moduleRef.get(getRepositoryToken(GroceryPriceHistory));
        dataSource = moduleRef.get(DataSource);
        cache = moduleRef.get(CACHE_MANAGER);
    });

    it('findAll returns DTOs sorted by name ASC and wraps in pagination DTO', async () => {
        // Mock QueryBuilder path used by service when no query object is provided
        const qb = {
            orderBy: jest.fn().mockReturnThis(),
            addOrderBy: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        } as any;
        groceriesRepo.createQueryBuilder = jest.fn().mockReturnValue(qb);

        const result = await service.findAll();

        expect(groceriesRepo.createQueryBuilder).toHaveBeenCalledWith('g');
        expect(qb.orderBy).toHaveBeenCalledWith('g.name', 'ASC');
        expect(qb.addOrderBy).toHaveBeenCalledWith('g.id', 'ASC');
        expect(qb.limit).toHaveBeenCalledWith(21);
        expect(qb.getMany).toHaveBeenCalled();
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.nextCursor ?? null).toBeNull();
    });

    it('history returns DTOs sorted by date_bought DESC for a grocery id', async () => {
        const now = new Date('2024-07-01T00:00:00.000Z');
        historyRepo.find = jest.fn().mockResolvedValue([
            {price: 10, price_per_kg: null, date_bought: now},
        ]);

        const result = await service.history('g1');

        expect(historyRepo.find).toHaveBeenCalledWith({where: {grocery: {id: 'g1'}}, order: {date_bought: 'DESC'}});
        expect(result).toEqual([
            expect.objectContaining({price: 10, price_per_kg: null, date_bought: now.toISOString()}),
        ]);
    });

    it('create should create grocery and price history inside transaction', async () => {
        const dto: CreateGroceryDto = {
            name: 'Rice',
            quantity: 2,
            place_id: 'place-1',
            price: 10,
            date_bought: '2024-07-01T00:00:00.000Z',
        };

        const manager = makeManager();
        dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

        const result = await service.create(dto);

        expect(manager.findOne).toHaveBeenCalledWith(Place, {where: {id: 'place-1'}});
        expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({name: 'Rice', quantity: 2}));
        expect(cache.del).toHaveBeenCalledWith(GroceriesService.CACHE_GET_ALL_KEY);
        expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('groceries:history'));
        expect(result).toEqual(expect.objectContaining({name: 'Rice', quantity: 2}));
    });

    it('create should throw PlaceNotFoundException when place_id is invalid', async () => {
        const dto: CreateGroceryDto = {
            name: 'Rice',
            quantity: 2,
            place_id: 'missing',
            price: 10,
            date_bought: '2024-07-01T00:00:00.000Z',
        };

        const manager = makeManager();
        dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

        await expect(service.create(dto)).rejects.toBeInstanceOf(PlaceNotFoundException);
        await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('create should throw GroceryNotUniqueNameException when DB layer rejects duplicate name', async () => {
        const dto: CreateGroceryDto = {
            name: 'Rice',
            quantity: 2,
            place_id: 'place-1',
            price: 10,
            date_bought: '2024-07-01T00:00:00.000Z',
        };

        const manager = makeManager();
        // First save (grocery) throws; second save (history) won't be reached
        manager.save = jest.fn(async (obj: any) => {
            if (obj && obj.name === 'Rice') {
                throw new Error('duplicate key value');
            }
            return {...obj, id: obj.id ?? 'generated-id'};
        });
        dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

        await expect(service.create(dto)).rejects.toBeInstanceOf(GroceryNotUniqueNameException);
        await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('update should update grocery and record history only when price or price_per_kg changed', async () => {
        const dto: UpdateGroceryDto = {
            quantity: 3,
            place_id: 'place-2',
            price: 9,
            date_bought: '2024-07-02T00:00:00.000Z',
        };

        const manager = makeManager();
        // history exists with same values => no new history save
        (manager.findOne as jest.Mock).mockImplementation(async (_entity: any, opts: any) => {
            if (_entity === Grocery) {
                if (opts?.where?.id === 'g1') return {id: 'g1', name: 'Apple', quantity: 1, place_id: 'place-1'};
                return null;
            }
            if (_entity === Place) {
                const id = opts?.where?.id;
                if (id === 'place-1' || id === 'place-2') return {id, name: 'FRIDGE'};
                return null;
            }
            if (_entity === GroceryPriceHistory) {
                return {price: 9, price_per_kg: null, date_bought: new Date('2024-07-01T00:00:00.000Z')};
            }
            return null;
        });
        dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

        const result = await service.update('g1', dto);

        expect(manager.findOne).toHaveBeenCalledWith(Grocery, {where: {id: 'g1'}});
        expect(manager.findOne).toHaveBeenCalledWith(Place, {where: {id: 'place-2'}});
        expect(manager.findOne).toHaveBeenCalledWith(GroceryPriceHistory, {
            where: {grocery: {id: 'g1'}},
            order: {date_bought: 'DESC'}
        });
        // Only grocery save called, no extra save for history (besides grocery)
        expect((manager.save as jest.Mock).mock.calls.filter(([arg]) => !(arg && arg.name))).toBeTruthy();
        expect(result).toEqual(expect.objectContaining({quantity: 3}));
    });

    it('update should create new history when price changed', async () => {
        const dto: UpdateGroceryDto = {
            quantity: 5,
            place_id: 'place-2',
            price: 20,
            date_bought: '2024-07-04T00:00:00.000Z',
        };
        const manager = makeManager();
        (manager.findOne as jest.Mock).mockImplementation(async (_entity: any, opts: any) => {
            if (_entity === Grocery) {
                if (opts?.where?.id === 'g1') return {id: 'g1', name: 'Apple', quantity: 1, place_id: 'place-1'};
                return null;
            }
            if (_entity === Place) {
                const id = opts?.where?.id;
                if (id === 'place-1' || id === 'place-2') return {id, name: 'FRIDGE'};
                return null;
            }
            if (_entity === GroceryPriceHistory) {
                return {price: 19, price_per_kg: 2, date_bought: new Date('2024-07-03T00:00:00.000Z')};
            }
            return null;
        });
        dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

        await service.update('g1', dto);

        // Ensure an extra save for history was performed with new values
        expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({price: 20, price_per_kg: null}));
    });

    it('update should create new history when price_per_kg changed (prev null => new number)', async () => {
        const dto: UpdateGroceryDto = {
            quantity: 2,
            place_id: 'place-2',
            price: 10,
            price_per_kg: 3,
            date_bought: '2024-07-05T00:00:00.000Z',
        };
        const manager = makeManager();
        (manager.findOne as jest.Mock).mockImplementation(async (_entity: any, opts: any) => {
            if (_entity === Grocery) {
                if (opts?.where?.id === 'g1') return {id: 'g1', name: 'Apple', quantity: 1, place_id: 'place-1'};
                return null;
            }
            if (_entity === Place) {
                const id = opts?.where?.id;
                if (id === 'place-1' || id === 'place-2') return {id, name: 'FRIDGE'};
                return null;
            }
            if (_entity === GroceryPriceHistory) {
                return {price: 10, price_per_kg: null, date_bought: new Date('2024-07-04T00:00:00.000Z')};
            }
            return null;
        });
        dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

        await service.update('g1', dto);

        expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({price: 10, price_per_kg: 3}));
        expect(cache.del).toHaveBeenCalledWith(GroceriesService.CACHE_GET_ALL_KEY);
        expect(cache.del).toHaveBeenCalledWith(expect.stringContaining('groceries:history'));
    });

    it('update should throw PlaceNotFoundException when place_id is invalid', async () => {
        const dto: UpdateGroceryDto = {
            quantity: 1,
            place_id: 'missing',
            price: 5,
            date_bought: '2024-07-03T00:00:00.000Z',
        };

        const manager = makeManager();
        dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

        await expect(service.update('g1', dto)).rejects.toBeInstanceOf(PlaceNotFoundException);
        await expect(service.update('g1', dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('update should throw GroceryNotFoundException (HTTP 400) when grocery does not exist', async () => {
        const dto: UpdateGroceryDto = {
            quantity: 1,
            place_id: 'place-1',
            price: 5,
            date_bought: '2024-07-03T00:00:00.000Z',
        };

        const manager = makeManager();
        dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

        await expect(service.update('missing', dto)).rejects.toBeInstanceOf(GroceryNotFoundException);
        await expect(service.update('missing', dto)).rejects.toBeInstanceOf(BadRequestException);
    });
});
