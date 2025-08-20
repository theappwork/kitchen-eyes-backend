import { ApiProperty } from '@nestjs/swagger';
import { Place } from '../place.entity';

export class PlaceDto {
  @ApiProperty({
    type: 'string',
    format: 'uuid',
    description: 'Place identifier',
  })
  id!: string;

  @ApiProperty({
    enum: ['FRIDGE', 'CABINET', 'FRUITS_BASKET'],
    description: 'One of FRIDGE, CABINET, FRUITS_BASKET',
  })
  name!: 'FRIDGE' | 'CABINET' | 'FRUITS_BASKET';

  static fromEntity(entity: Place): PlaceDto {
    const dto = new PlaceDto();
    dto.id = entity.id;
    dto.name = entity.name;
    return dto;
  }

  static fromEntities(entities: Place[]): PlaceDto[] {
    return entities.map((e) => PlaceDto.fromEntity(e));
  }
}
