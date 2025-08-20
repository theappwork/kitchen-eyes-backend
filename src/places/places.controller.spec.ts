import {Test} from '@nestjs/testing';
import {PlacesController} from './places.controller';
import {PlacesService} from './places.service';

describe('PlacesController', () => {
    let controller: PlacesController;
    let service: { findAll: jest.Mock };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [PlacesController],
            providers: [
                {
                    provide: PlacesService,
                    useValue: {
                        findAll: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = moduleRef.get(PlacesController);
        service = moduleRef.get(PlacesService);
    });

    it('GET /places -> returns service.findAll()', async () => {
        const data = [{id: '1', name: 'FRIDGE'}];
        service.findAll.mockResolvedValue(data);

        const result = await controller.findAll();

        expect(service.findAll).toHaveBeenCalled();
        expect(result).toBe(data);
    });
});
