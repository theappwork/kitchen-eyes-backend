import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Place} from './place.entity';
import { PlaceDto } from './dto/place.dto';

@Injectable()
export class PlacesService {
    constructor(
        @InjectRepository(Place) private repo: Repository<Place>,
    ) {
    }

    async findAll(): Promise<PlaceDto[]> {
        const entities = await this.repo.find({ order: { name: 'ASC' } });
        return PlaceDto.fromEntities(entities);
    }
}
