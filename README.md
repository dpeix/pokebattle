# pokebattle

Simulateur de combat web, organisé en monorepo pnpm + Turborepo.

## Prérequis

- Node.js 24 (`.nvmrc`)
- pnpm 11 (version fixée par `packageManager` dans `package.json`)
- Docker + Docker Compose
- `make` et `openssl` (présents par défaut sur macOS et la plupart des Linux)

## Structure

```
apps/
  web/            # @pokebattle/web : interface React Router v7 (mode framework, SSR, Tailwind) (port 5173)
  battle-engine/  # @pokebattle/battle-engine : API Fastify du simulateur de combat (port 3001)
                  #   + compose.yaml : base PostgreSQL dédiée (port 5433), accès via Drizzle
  user-api/       # API Symfony de gestion des utilisateurs (symfony-docker, FrankenPHP), hors workspace pnpm
packages/
  shared/     # @pokebattle/shared : types et contrats partagés (compilé dans dist/)
  tsconfig/   # @pokebattle/tsconfig : configs TypeScript de base (base.json, node.json)
```

## Démarrage

```sh
make setup   # une seule fois : dépendances, fichiers .env locaux, images Docker, clés JWT, base de test
make dev     # toute la stack : web, battle-engine, bases PostgreSQL et API Symfony
```

`make setup` peut être relancé sans risque : il ne remplace jamais un `.env` ou une clé existants. Il crée `apps/battle-engine/.env` (mot de passe Postgres aléatoire) et ajoute `JWT_PASSPHRASE` dans `apps/user-api/.env.local`. Ces fichiers ne sont jamais commités.

`make dev` démarre les conteneurs en arrière-plan, puis le web et le battle-engine en mode watch au premier plan. Après Ctrl-C, les conteneurs restent démarrés : `make down` les arrête.

## Commandes

Le `Makefile` est le point d'entrée ; `make` (ou `make help`) liste toutes les cibles. Les principales :

| Commande         | Rôle                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `make up` / `make down` / `make ps` | Démarre / arrête / liste les conteneurs (les volumes de données sont conservés) |
| `make lint`      | Biome, PHP-CS-Fixer et PHPStan                                       |
| `make format`    | Formate le code (Biome et PHP-CS-Fixer)                              |
| `make typecheck` / `make build` | Types et build des paquets TypeScript (Turborepo)      |
| `make test`      | Tests Node (Vitest) et PHP (PHPUnit), conteneurs démarrés au besoin  |
| `make ci`        | Les mêmes vérifications que la CI                                    |
| `make db-generate` / `make db-migrate` | Migrations Drizzle du battle-engine             |
| `make api-console ARGS="…"` / `make api-shell` | Console Symfony / shell dans le conteneur PHP |
| `make api-migrate` | Migrations Doctrine (dev)                                          |

Les cibles `api-*` qui exécutent une commande dans le conteneur PHP supposent l'API démarrée (`make up`).

Les scripts pnpm restent utilisables directement (le `Makefile` les appelle) : `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm db:up`, `pnpm db:down`, `pnpm api:up`, `pnpm api:down`, `pnpm api:test`. Drizzle Studio : `pnpm --filter @pokebattle/battle-engine db:studio`.

`pnpm test` (Turborepo) ne lance que les tests Node, qui ont besoin de la base du battle-engine (`make db-up`) ; les tests PHP passent par `make api-test`.

Les migrations Doctrine sont appliquées automatiquement au démarrage du conteneur (base PostgreSQL `database`, propre à l'API).

## Services

| Service         | URL en dev               | Détails                                                     |
| --------------- | ------------------------ | ----------------------------------------------------------- |
| `web`           | http://localhost:5173    | Interface utilisateur (`apps/web/app/routes.ts` pour les routes) |
| `battle-engine` | http://localhost:3001    | `GET /health` (200, ou 503 si la base est injoignable) ; variables : voir `apps/battle-engine/.env.example` |
| `user-api`      | https://localhost        | API Symfony 8 ; certificat TLS local auto-signé à accepter. Commandes : `docker compose exec php bin/console …` dans `apps/user-api` |
| PostgreSQL de l'API utilisateurs | port hôte aléatoire (`docker compose port database 5432`) | Service `database` de `apps/user-api/compose.yaml`, utilisé uniquement par l'API Symfony |
| PostgreSQL du battle-engine | localhost:5433 | Conteneur `apps/battle-engine/compose.yaml`, utilisé uniquement par le battle-engine |

### Authentification (API utilisateurs)

| Endpoint                  | Accès    | Rôle                                                              |
| ------------------------- | -------- | ----------------------------------------------------------------- |
| `POST /api/users`         | public   | Inscription : `{ "email", "password" }` (8 caractères min.) → 201 |
| `POST /api/login_check`   | public   | Login : `{ "email", "password" }` → `{ "token", "refresh_token" }` |
| `POST /api/token/refresh` | public   | `{ "refresh_token" }` → nouveaux `token` et `refresh_token`       |
| `GET /api/me`             | JWT      | Utilisateur connecté                                              |
| `GET /api/users/{id}`     | JWT      | Uniquement son propre compte (403 sinon)                         |

Le JWT (valable 15 min) s'envoie dans l'en-tête `Authorization: Bearer <token>`. Le refresh token (30 jours) ne sert qu'une fois : chaque refresh en renvoie un nouveau, à conserver à la place de l'ancien. Le login est limité à 5 échecs par minute (email + IP). Documentation OpenAPI : https://localhost/api/docs.



- **pnpm workspaces + Turborepo** : orchestration et cache des tâches `build`, `dev`, `typecheck`, `test`.
- **Biome** : lint et formatage du code TypeScript/JSON, configuré une seule fois à la racine (`biome.json`).
- **Fastify** pour le simulateur : `buildApp()` (`apps/battle-engine/src/app.ts`) construit l'application sans ouvrir de port, les tests passent par `app.inject()` (Vitest).
- **PostgreSQL + Drizzle** pour les données du simulateur (futur import PokeAPI) : base dédiée au battle-engine, conteneurisée ; le serveur Fastify tourne sur l'hôte. Le client est exposé via `app.db` (`src/plugins/db.ts`). Les migrations générées dans `drizzle/` sont commitées et ne se modifient pas à la main.
- **Variables d'environnement** : `.env` (non commité) chargé par `loadDotEnv()` (`src/env.ts`, `process.loadEnvFile` natif) et lu aussi par Docker Compose.
- **Tests non mis en cache** par Turborepo (`turbo.json`) : ils dépendent de l'état de la base.
- **Scripts d'installation** : pnpm 11 les bloque par défaut ; les paquets autorisés sont listés dans `allowBuilds` (`pnpm-workspace.yaml`).
- **React Router v7** (mode framework) généré depuis la branche `v7` de `remix-run/react-router-templates` ; la v8 est sortie mais la v7 est demandée. Le Dockerfile npm du template a été retiré (incompatible avec le monorepo pnpm). Biome analyse les directives Tailwind v4 (`css.parser.tailwindDirectives`).
- **symfony-docker** pour l'API utilisateurs : copié depuis `dunglas/symfony-docker` au commit `4227566` (2026-08-31, sans son historique git), squelette Symfony 8.1 généré par le conteneur au premier démarrage. Sa documentation amont est dans `apps/user-api/README.md` et `apps/user-api/docs/` ; ses fichiers `.github/` ne sont pas exécutés depuis ce sous-dossier.
- **FrankenPHP fixé en 1.12** (`apps/user-api/Dockerfile`) : la 1.13 embarque Mercure 1.0, incompatible avec la config Mercure du template (le conteneur redémarre en boucle, dunglas/symfony-docker#968). À retirer quand la PR amont #969 sera publiée et reportée ici.
- **API utilisateurs** : API Platform 5 + Doctrine ORM (PostgreSQL), SecurityBundle, LexikJWTAuthenticationBundle, NelmioCorsBundle. La passphrase JWT est dans `.env.local` (non commité) ; `.env.test` contient une passphrase de test non sensible car Symfony ne charge pas `.env.local` en environnement de test.
- **Front en BFF** : le serveur React Router appellera l'API utilisateurs et gardera les tokens dans sa propre session (cookie httpOnly) ; Symfony renvoie donc les tokens dans le corps JSON, sans cookie, et le navigateur n'appelle pas l'API directement.
- **Utilisateurs** : identifiant UUID v7 (non énumérable), email normalisé en minuscules (unicité insensible à la casse), mot de passe haché par `App\State\UserPasswordHasher`, rôles ignorés à l'inscription.
- **Refresh tokens** : GesdinetJWTRefreshTokenBundle v3, usage unique (rotation) et stockage haché en base. Sa détection de réutilisation (`reuse_detection`) n'est pas activée : en 3.0.0 elle empêche le conteneur de se construire (markitosgv/JWTRefreshTokenBundle#434) et reste inopérante avec les tokens hachés (#433). Sa recipe Flex est « contrib », la configuration (`config/packages/gesdinet_jwt_refresh_token.yaml`) est écrite à la main.
- **Tests de l'API utilisateurs** : PHPUnit + `ApiTestCase` (`api-platform/test`), Foundry pour les données, DAMA DoctrineTestBundle (chaque test est annulé par rollback). La recipe DAMA est « contrib » et ignorée par Flex (`allow-contrib` désactivé) : le bundle et l'extension PHPUnit sont enregistrés à la main comme le fait la recipe.
- **Qualité PHP** (API utilisateurs) : PHPStan au niveau max (`phpstan.dist.neon`, extensions Symfony, Doctrine et PHPUnit, sur `src/` et `tests/`) et PHP-CS-Fixer en règles `@Symfony` (`.php-cs-fixer.dist.php`). L'option `allowNullablePropertyForRequiredField` est activée : les entités restent incomplètes jusqu'à la validation d'API Platform, et les colonnes NOT NULL font office de garde-fou. `phpstan/phpstan` est fixé en 2.3.0, car la 2.3.1 avait moins d'un jour à l'installation.
- **TypeScript 6** : la v7 n'est pas encore supportée par les outils de React Router v7.
