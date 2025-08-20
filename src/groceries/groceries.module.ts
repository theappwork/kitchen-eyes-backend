import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {GroceriesController} from './groceries.controller';
import {GroceriesService} from './groceries.service';
import {Grocery} from './grocery.entity';
import {Place} from '../places/place.entity';
import {GroceryPriceHistory} from '../groceries-price-history/grocery-price-history.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Grocery, Place, GroceryPriceHistory])],
    controllers: [GroceriesController],
    providers: [GroceriesService],
})
export class GroceriesModule {
}
