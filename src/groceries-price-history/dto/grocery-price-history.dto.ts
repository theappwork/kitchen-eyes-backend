import {GroceryPriceHistory} from "../grocery-price-history.entity";
import { ApiProperty } from '@nestjs/swagger';

export class GroceryPriceHistoryDto {
    @ApiProperty()
    price!: number;

    @ApiProperty({
        nullable: true,
        description: 'Optional',
    })
    price_per_kg?: number | null;

    @ApiProperty({
        type: 'string',
        format: 'date-time',
        example: '2024-01-01T00:00:00.000Z',
        description: 'Date bought in ISO 8601 format',
    })
    date_bought!: string;

    static fromEntity(
        entity: GroceryPriceHistory,
    ): GroceryPriceHistoryDto {
        const dto = new GroceryPriceHistoryDto();
        dto.price = entity.price;
        dto.price_per_kg = entity.price_per_kg;
        dto.date_bought = entity.date_bought.toISOString();
        return dto;
    }

    static fromEntities(entities: GroceryPriceHistory[]): GroceryPriceHistoryDto[] {
        return entities.map((e) => GroceryPriceHistoryDto.fromEntity(e));
    }
}