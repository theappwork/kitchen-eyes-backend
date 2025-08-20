import {BadRequestException} from '@nestjs/common';

export class PlaceNotFoundException extends BadRequestException {
    constructor() {
        super('place_id not found');
    }
}
