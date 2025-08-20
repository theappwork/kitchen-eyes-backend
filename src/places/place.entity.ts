import {Column, Entity, PrimaryGeneratedColumn, Unique} from 'typeorm';

@Entity({name: 'place'})
@Unique(['name'])
export class Place {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({type: 'varchar', length: 64})
    name!: 'FRIDGE' | 'CABINET' | 'FRUITS_BASKET';
}
