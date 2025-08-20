import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {PlacesController} from './places.controller';
import {PlacesService} from './places.service';
import {Place} from './place.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Place])],
    controllers: [PlacesController],
    providers: [PlacesService],
    exports: [TypeOrmModule],
})
export class PlacesModule {
}
