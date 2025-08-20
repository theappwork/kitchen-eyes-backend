import {IsDateString, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGroceryDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty()
    @IsNumber()
    @IsPositive()
    quantity!: number;

    @ApiProperty()
    @IsUUID()
    place_id!: string;

    @ApiProperty()
    @IsNumber()
    @IsPositive()
    price!: number;

    @ApiProperty()
    @IsNumber()
    @IsOptional()
    @IsPositive()
    price_per_kg?: number;

    @ApiProperty()
    @IsDateString()
    date_bought!: string;
}
