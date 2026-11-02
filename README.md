# JonisFlow — Stack local sem Docker (preview/CI)

Para ambientes sem Docker (CI, sandbox): o Postgres é embedded via npm
(`@embedded-postgres/linux-x64`), o cliente Prisma usa o **WASM engine**
(`PRISMA_CLIENT_FORCE_WASM=1` + `engineType = "library"` + `@prisma/adapter-pg`)
e o schema é aplicado com `npm run apply-schema` (sem psql). Em produção/local
com Docker, use o `docker-compose.yml` principal.

```bash
cd apps/api
npm run apply-schema   # cria database + schema.sql
npm run smoke          # smoke test: Prisma + Postgres
npm run dev            # API em :4000
```
