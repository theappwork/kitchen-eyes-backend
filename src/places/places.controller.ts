import {Controller, Get} from '@nestjs/common';
import {PlacesService} from './places.service';
import {ApiOkResponse, ApiOperation, ApiTags} from '@nestjs/swagger';
import {PlaceDto} from './dto/place.dto';

@ApiTags('Places')
@Controller('places')
export class PlacesController {
    constructor(private readonly placesService: PlacesService) {
    }

    @Get()
    @ApiOperation({summary: 'List available places'})
    @ApiOkResponse({
        description: 'List of places',
        type: PlaceDto,
        isArray: true,
    })
    findAll(): Promise<PlaceDto[]> {
        return this.placesService.findAll();
    }
}
