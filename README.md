# XO Backend

Node.js + Express backend using PostgreSQL.

## Setup

Install dependencies:

```bash
cd xo_backend
npm install
```

Set `DATABASE_URL` to your PostgreSQL connection string. The schema is created automatically on startup.

Start the backend:

```bash
npm run dev
```

## API Endpoints

- `GET /api/status` - health check
- `GET /api/players` - list players
- `POST /api/players` - create player
- `GET /api/games` - list games
- `POST /api/games` - create game
