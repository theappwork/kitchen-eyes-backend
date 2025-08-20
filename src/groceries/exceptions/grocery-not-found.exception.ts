import {BadRequestException} from '@nestjs/common';

export class GroceryNotFoundException extends BadRequestException {
    constructor() {
        super('grocery_id not found');
    }
}
