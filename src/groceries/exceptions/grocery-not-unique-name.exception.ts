import {BadRequestException} from '@nestjs/common';

export class GroceryNotUniqueNameException extends BadRequestException {
    constructor() {
        super('name must be unique');
    }
}
