# Kitchen Eyes

So, I was one day thinking: what I could do with my Raspberry Pi?. 

I recently bought one and thinking about buying two more, I was planning on build a cluster and doing other stuff.

<quote>Why not build something for my kitchen?</quote>

I remembered, back in the day, about "smart" fridges, having a screen and doing some other stuff (I think it had only a browser, gallery of photos, pretty basic stuff).

<quote>Maybe I can build something better. why not track groceries and give my kitchen (or fridge) the ability to notify me when I have to re-stock?, maybe track my expenses?, create lists of groceries?, etc.</quote>

And that is how "Kitchen Eyes" was born. Basically, a solution for the questions above (and more).

## New here?

Feel free to drop a comment or open an issue if you have any questions, enhancements or suggestions.

## Disclaimer

It's not meant to be publicly available, it is a solution for a personal problem at home. If you like the idea, feel free to fork it.

## Technology Stack

- **Backend**: NestJS (TypeScript)
- **Database**: PostgreSQL
- **Testing**: Jest
- **API Documentation**: Swagger/OpenAPI
- **Cache**: Redis (via cache-manager)
- **HTTP Server**: Fastify
- **ORM**: TypeORM
- **Containerization**: Docker (via testcontainers)
- **Package Manager**: pnpm

## REST API

The API provides endpoints to manage groceries:

- `GET /groceries` - Retrieve all groceries
- `POST /groceries` - Create a new grocery item
- `PUT /groceries/:id` - Update an existing grocery item
- `GET /groceries/:id/history` - Get price history for a specific grocery item

