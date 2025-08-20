import {Grocery} from '../grocery.entity';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';

export class GroceryDto {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    name!: string;

    @ApiProperty()
    quantity!: number;

    @ApiProperty()
    place_id!: string;

    static fromEntity(entity: Grocery): GroceryDto {
        const dto = new GroceryDto();
        dto.id = entity.id;
        dto.name = entity.name;
        dto.quantity = entity.quantity;
        dto.place_id = entity.place_id;
        return dto;
    }

    static fromEntities(entities: Grocery[]): GroceryDto[] {
        return entities.map((e) => GroceryDto.fromEntity(e));
    }
}

export class ListGroceriesDto {
    @ApiProperty({ type: [GroceryDto] })
    items!: GroceryDto[];

    @ApiPropertyOptional({ description: 'Next cursor to continue pagination (null if no more items)' })
    nextCursor?: string | null;

    static of(items: Grocery[], nextCursor: string | null = null): ListGroceriesDto {
        const dto = new ListGroceriesDto();
        dto.items = GroceryDto.fromEntities(items);
        dto.nextCursor = nextCursor;
        return dto;
    }
}
