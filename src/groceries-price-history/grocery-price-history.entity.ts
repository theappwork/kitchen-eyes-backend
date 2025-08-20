import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {Grocery} from '../groceries/grocery.entity';

@Entity({name: 'grocery_price_history'})
export class GroceryPriceHistory {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => Grocery, (g) => g.priceHistory, {onDelete: 'CASCADE', nullable: false})
    @JoinColumn({name: 'grocery_id'})
    grocery!: Promise<Grocery>;

    @Column({
        type: 'numeric',
        precision: 5,
        scale: 2,
        transformer: {from: (value: string) => parseFloat(value), to: (value: number) => value}
    })
    price!: number;

    @Column({
        type: 'numeric',
        nullable: true,
        precision: 5,
        scale: 2,
        transformer: {
            from: (value: string | null) => value ? parseFloat(value) : null,
            to: (value: number | null) => value
        }
    })
    price_per_kg?: number | null;

    @Column({type: 'timestamptz'})
    date_bought!: Date;
}
