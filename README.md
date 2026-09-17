# XO Backend

Simple Node.js + Express backend using SQLite.

## Setup

Install dependencies:

```bash
cd backend
npm install
```

Initialize the database:

```bash
npm run init-db
```

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
