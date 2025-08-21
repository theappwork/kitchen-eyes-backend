import {Body, Controller, Get, Param, Post, Put, Query, UseInterceptors} from '@nestjs/common';
import {GroceriesService} from './groceries.service';
import {CreateGroceryDto} from './dto/create-grocery.dto';
import {UpdateGroceryDto} from './dto/update-grocery.dto';
import {CacheKey, CacheTTL} from '@nestjs/cache-manager';
import {CustomHistoryByIdInterceptor} from '../groceries-price-history/interceptors/custom-history-by-id.interceptor';
import {ApiBadRequestResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags} from '@nestjs/swagger';
import {GroceryDto, ListGroceriesDto} from './dto/grocery.dto';
import {GroceryPriceHistoryDto} from '../groceries-price-history/dto/grocery-price-history.dto';
import {FindGroceriesQueryDto} from './dto/find-groceries.query';

@ApiTags('Groceries')
@Controller('groceries')
export class GroceriesController {
    constructor(private readonly groceriesService: GroceriesService) {}

    @Get()
    @ApiOperation({ summary: 'List groceries' })
    @ApiOkResponse({ description: 'List of groceries', type: ListGroceriesDto })
    @ApiQuery({ name: 'name', required: false, description: 'Filter by name (case-insensitive, contains match)' })
    @ApiQuery({ name: 'place', required: false, description: 'Filter by place id' })
    @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor' })
    @ApiQuery({ name: 'limit', required: false, description: 'Max items to return (default 20, max 100)' })
    findAll(@Query() query?: FindGroceriesQueryDto) {
        return this.groceriesService.findAll(query);
    }

    @Get(':id/history')
    @ApiOperation({ summary: 'Get grocery price history by grocery id' })
    @ApiParam({ name: 'id', type: String, description: 'Grocery ID (UUID)' })
    @ApiOkResponse({ description: 'Price history entries (newest first)', type: GroceryPriceHistoryDto, isArray: true })
    @CacheKey(GroceriesService.CACHE_HISTORY_KEY)
    @CacheTTL(5 * 60 * 1000)
    @UseInterceptors(CustomHistoryByIdInterceptor)
    history(@Param('id') id: string) {
        return this.groceriesService.history(id);
    }

    @Post()
    @ApiOperation({ summary: 'Create a grocery and register price history' })
    @ApiCreatedResponse({ description: 'Grocery created', type: GroceryDto })
    @ApiBadRequestResponse({ description: 'Validation failed' })
    create(@Body() dto: CreateGroceryDto) {
        return this.groceriesService.create(dto);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a grocery and add price history when price changes' })
    @ApiParam({ name: 'id', type: String, description: 'Grocery ID (UUID)' })
    @ApiOkResponse({ description: 'Updated grocery', type: GroceryDto })
    @ApiBadRequestResponse({ description: 'Validation failed or grocery not found' })
    update(@Param('id') id: string, @Body() dto: UpdateGroceryDto) {
        return this.groceriesService.update(id, dto);
    }
}
