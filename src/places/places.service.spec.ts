import {PlacesService} from './places.service';
import {Repository} from 'typeorm';
import {Place} from './place.entity';
import {getRepositoryToken} from '@nestjs/typeorm';
import {Test} from '@nestjs/testing';
import { PlaceDto } from './dto/place.dto';

describe('PlacesService', () => {
    let service: PlacesService;
    let repo: jest.Mocked<Repository<Place>>;

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                PlacesService,
                {
                    provide: getRepositoryToken(Place),
                    useValue: {
                        find: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = moduleRef.get(PlacesService);
        repo = moduleRef.get(getRepositoryToken(Place));
    });

    it('should call repo.find with correct order and return results', async () => {
        const places: Place[] = [
            {id: '1', name: 'CABINET'},
            {id: '2', name: 'FRIDGE'},
        ];
        repo.find.mockResolvedValue(places);

        const result = await service.findAll();

        expect(repo.find).toHaveBeenCalledWith({order: {name: 'ASC'}});
        expect(result).toEqual(PlaceDto.fromEntities(places));
    });
});
