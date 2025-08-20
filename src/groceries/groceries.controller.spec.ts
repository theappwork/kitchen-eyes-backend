import {Test} from '@nestjs/testing';
import {GroceriesController} from './groceries.controller';
import {GroceriesService} from './groceries.service';
import {CreateGroceryDto} from './dto/create-grocery.dto';
import {UpdateGroceryDto} from './dto/update-grocery.dto';
import {CacheModule} from "@nestjs/cache-manager";

describe('GroceriesController', () => {
    let controller: GroceriesController;
    let service: {
        findAll: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
        history: jest.Mock;
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                CacheModule.register(),
            ],
            controllers: [GroceriesController],
            providers: [
                {
                    provide: GroceriesService,
                    useValue: {
                        findAll: jest.fn(),
                        create: jest.fn(),
                        update: jest.fn(),
                        history: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = moduleRef.get(GroceriesController);
        service = moduleRef.get(GroceriesService);
    });

    it('GET /groceries -> delegates to service.findAll()', async () => {
        const data = [{id: 'g1', name: 'Apple'}];
        service.findAll.mockResolvedValue(data);

        const result = await controller.findAll();

        expect(service.findAll).toHaveBeenCalled();
        expect(result).toBe(data);
    });

    it('GET /groceries/:id/history -> delegates to service.history()', async () => {
        const data = [{id: 'g1', name: 'Apple'}];
        service.history.mockResolvedValue(data);

        const result = await controller.history('g1');

        expect(service.history).toHaveBeenCalledWith('g1');
        expect(result).toBe(data);
    });

    it('POST /groceries/:id -> delegates to service.create()', async () => {
        const dto: CreateGroceryDto = {
            name: 'Rice',
            quantity: 2,
            place_id: 'place-1',
            price: 10,
            date_bought: new Date().toISOString(),
        };
        const saved = {id: 'g2', ...dto};
        service.create.mockResolvedValue(saved);

        const result = await controller.create(dto);

        expect(service.create).toHaveBeenCalledWith(dto);
        expect(result).toBe(saved);
    });

    it('PUT /groceries/:id -> delegates to service.update()', async () => {
        const dto: UpdateGroceryDto = {
            quantity: 3,
            place_id: 'place-2',
            price: 9,
            date_bought: new Date().toISOString(),
        };
        const updated = {id: 'g2', name: 'Rice', quantity: 3};
        service.update.mockResolvedValue(updated);

        const result = await controller.update('g2', dto);

        expect(service.update).toHaveBeenCalledWith('g2', {
            "date_bought": dto.date_bought,
            "place_id": dto.place_id,
            "price": dto.price,
            "quantity": dto.quantity
        });
        expect(result).toBe(updated);
    });
});
