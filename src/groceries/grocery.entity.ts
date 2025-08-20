import {Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, RelationId, Unique} from 'typeorm';
import {Place} from '../places/place.entity';
import {GroceryPriceHistory} from '../groceries-price-history/grocery-price-history.entity';

@Entity({name: 'grocery'})
@Unique(['name'])
export class Grocery {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({type: 'varchar', length: 255})
    name!: string;

    @Column({type: 'numeric'})
    quantity!: number;

    @ManyToOne(() => Place, {nullable: false, onDelete: 'RESTRICT'})
    @JoinColumn({name: 'place_id'})
    place!: Promise<Place>;

    // Expose foreign key without loading relation
    @RelationId((g: Grocery) => g.place)
    place_id!: string;

    @OneToMany(() => GroceryPriceHistory, (gph) => gph.grocery)
    priceHistory!: Promise<GroceryPriceHistory[]>;
}
