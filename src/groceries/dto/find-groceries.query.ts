import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class FindGroceriesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by name (case-insensitive, contains match)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by place id' })
  @IsOptional()
  @IsString()
  place?: string;

  @ApiPropertyOptional({ description: 'Pagination cursor' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Max items to return', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
