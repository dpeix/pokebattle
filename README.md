# pokebattle

Simulateur de combat web, organisé en monorepo pnpm + Turborepo.

## Prérequis

- Node.js 24 (`.nvmrc`)
- pnpm 11 (version fixée par `packageManager` dans `package.json`)
- Docker + Docker Compose

## Structure

```
apps/
  web/            # @pokebattle/web : interface React Router v7 (mode framework, SSR, Tailwind) (port 5173)
  battle-engine/  # @pokebattle/battle-engine : API Fastify du simulateur de combat (port 3001)
                  #   + compose.yaml : base PostgreSQL dédiée (port 5433), accès via Drizzle
packages/
  shared/     # @pokebattle/shared : types et contrats partagés (compilé dans dist/)
  tsconfig/   # @pokebattle/tsconfig : configs TypeScript de base (base.json, node.json)
```

## Commandes

À lancer depuis la racine :

| Commande         | Rôle                                               |
| ---------------- | -------------------------------------------------- |
| `pnpm install`   | Installe les dépendances de tout le workspace      |
| `pnpm dev`       | Lance tous les services Node en mode développement |
| `pnpm build`     | Build de tous les paquets (Turborepo)              |
| `pnpm typecheck` | Vérification de types de tous les paquets          |
| `pnpm test`      | Tests de tous les paquets                          |
| `pnpm lint`      | Lint + vérification du formatage (Biome)           |
| `pnpm format`    | Formate le code (Biome)                            |
| `pnpm db:up`     | Démarre la base PostgreSQL du battle-engine        |
| `pnpm db:down`   | Arrête la base (les données restent dans le volume) |

Commandes Drizzle (dans `apps/battle-engine`, ou via `pnpm --filter @pokebattle/battle-engine <script>`) :
`db:generate` (génère les migrations SQL dans `drizzle/` depuis `src/db/schema.ts`), `db:migrate` (les applique), `db:studio`.

## Démarrage

```sh
pnpm install
cp apps/battle-engine/.env.example apps/battle-engine/.env   # puis changer le mot de passe (2 endroits)
pnpm db:up
pnpm dev
```

`pnpm test` a besoin de la base démarrée (`pnpm db:up`) : le test de santé du battle-engine interroge la vraie base.

## Services

| Service         | URL en dev               | Détails                                                     |
| --------------- | ------------------------ | ----------------------------------------------------------- |
| `web`           | http://localhost:5173    | Interface utilisateur (`apps/web/app/routes.ts` pour les routes) |
| `battle-engine` | http://localhost:3001    | `GET /health` (200, ou 503 si la base est injoignable) ; variables : voir `apps/battle-engine/.env.example` |
| PostgreSQL du battle-engine | localhost:5433 | Conteneur `apps/battle-engine/compose.yaml`, utilisé uniquement par le battle-engine |

## Choix techniques

- **pnpm workspaces + Turborepo** : orchestration et cache des tâches `build`, `dev`, `typecheck`, `test`.
- **Biome** : lint et formatage du code TypeScript/JSON, configuré une seule fois à la racine (`biome.json`).
- **Fastify** pour le simulateur : `buildApp()` (`apps/battle-engine/src/app.ts`) construit l'application sans ouvrir de port, les tests passent par `app.inject()` (Vitest).
- **PostgreSQL + Drizzle** pour les données du simulateur (futur import PokeAPI) : base dédiée au battle-engine, conteneurisée ; le serveur Fastify tourne sur l'hôte. Le client est exposé via `app.db` (`src/plugins/db.ts`). Les migrations générées dans `drizzle/` sont commitées et ne se modifient pas à la main.
- **Variables d'environnement** : `.env` (non commité) chargé par `loadDotEnv()` (`src/env.ts`, `process.loadEnvFile` natif) et lu aussi par Docker Compose.
- **Tests non mis en cache** par Turborepo (`turbo.json`) : ils dépendent de l'état de la base.
- **Scripts d'installation** : pnpm 11 les bloque par défaut ; les paquets autorisés sont listés dans `allowBuilds` (`pnpm-workspace.yaml`).
- **React Router v7** (mode framework) généré depuis la branche `v7` de `remix-run/react-router-templates` ; la v8 est sortie mais la v7 est demandée. Le Dockerfile npm du template a été retiré (incompatible avec le monorepo pnpm). Biome analyse les directives Tailwind v4 (`css.parser.tailwindDirectives`).
- **TypeScript 6** : la v7 n'est pas encore supportée par les outils de React Router v7.
