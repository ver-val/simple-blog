# Simple Blog (Go + React + PostgreSQL)

## Repository Info
- Student: Valeriia Vereshchynska
- Branching strategy: Trunk-based development

## Stack
- Backend: Go (`net/http`, `chi`, `pgx`, JWT)
- Frontend: React + Vite
- Database: PostgreSQL

## Project Structure
- `server/` - Go API
- `client/` - React app
- `server/migrations/001_init.sql` - DB schema
- `docker-compose.yml` - local PostgreSQL

## Run PostgreSQL
```bash
cp .env.example .env
docker compose up -d
```

## Run Full Stack In Docker
```bash
cp .env.example .env
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

Docker services read runtime/build values from root `.env` (see `.env.example`).

## Apply Migration
```bash
psql "postgres://postgres:postgres@localhost:5432/blog?sslmode=disable" -f server/migrations/001_init.sql
```

`docker compose up --build` applies `001_init.sql` automatically via the `migrate` service.

## Run Backend
```bash
cd server
cp .env.example .env
export $(cat .env | xargs)
go run ./cmd/server
```

Server runs on `http://localhost:8080`.

## Run Frontend
```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`.

## Run Tests
```bash
make test
```

## Run UI Tests
```bash
make browser-test
```

This starts the frontend locally and runs:
- Selenium IDE record-and-play tests
- Robot Framework keyword-driven tests

## Run Selenium WebDriver Tests
```bash
make selenium-webdriver-install
make selenium-webdriver-test
```

The Selenium WebDriver tests use the Page Object pattern and save screenshots after each test step in `tests/selenium/screenshots/`.

## Run Cucumber Tests
```bash
make cucumber-install
make cucumber-test
```

The Cucumber tests use Gherkin `.feature` files and generate a JSON report in `tests/cucumber/results/cucumber-report.json`.

## Run Coverage
```bash
make coverage
```

This runs:
- backend coverage via Go `coverprofile`
- frontend coverage via `vitest --coverage`

Run separately:
```bash
make coverage-api
make coverage-ui
```

## Run CI Checks Locally
```bash
make lint
make test
go install honnef.co/go/tools/cmd/staticcheck@latest
make quality
```

## GitHub Actions CI
The repository contains a GitHub Actions workflow in `.github/workflows/ci.yml`.
It runs on every pull request targeting `main`.
The workflow has separate jobs for:
- tests
- lint and style checks
- static code analysis via `staticcheck`

## Git Pre-Push Hook
Hook runs before every `git push` and executes:
- server lint (`gofmt` check + `go vet`)
- server unit tests
- client lint (`eslint`)
- client unit tests (`vitest`)
- Selenium IDE record-and-play UI tests
- Robot Framework keyword-driven UI tests

Setup:
```bash
./scripts/install-git-hooks.sh
```

## Main API Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/posts`
- `GET /api/posts/{postID}`
- `POST /api/posts` (auth)
- `GET /api/posts/{postID}/comments`
- `POST /api/posts/{postID}/comments` (auth)
- `GET /api/profile/me` (auth)
- `PUT /api/profile/me` (auth)
- `GET /api/users/{userID}/posts`

## Postman Collection
- Collection: `postman/blog-api.postman_collection.json`
- Environment: `postman/blog-api.postman_environment.json`

Import both files into Postman, select `Blog API Local` environment, then run requests in this order:
1. `Auth / Register` or `Auth / Login` (stores `token`, `userId`)
2. `Posts / Create Post (Auth)` (stores `postId`)
3. `Comments / Add Comment (Auth)` / `Profile (Auth)` requests

## Notes
- Password reset token is returned as `debugToken` in API response and also logged by backend for local development.
- For production, send reset tokens via email and remove debug token from responses.
