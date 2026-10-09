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
                  #   vues uniquement, sans logique métier (serveur en BFF vers les API)
  battle-engine/  # @pokebattle/battle-engine : API Fastify du simulateur de combat (port 3001)
                  #   simulateur et données PokeAPI ; plugins et routes chargés par @fastify/autoload
                  #   + compose.yaml : base PostgreSQL dédiée (port 5433), accès via Drizzle
  user-api/       # API Symfony 8.1 des fonctionnalités utilisateurs : login, chat, équipes…
                  #   (symfony-docker, FrankenPHP), hors workspace pnpm
packages/
  shared/     # @pokebattle/shared : types et contrats partagés (compilé dans dist/)
  tsconfig/   # @pokebattle/tsconfig : configs TypeScript de base (base.json, node.json)
```

La section « Périmètre des applications » de `CLAUDE.md` indique où placer une fonctionnalité.

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
| `make db-import` | Importe les données de combat PokeAPI dans la base du battle-engine (après `make db-migrate`) |
| `make api-console ARGS="…"` / `make api-shell` | Console Symfony / shell dans le conteneur PHP |
| `make api-migrate` | Migrations Doctrine (dev)                                          |

Les cibles `api-*` qui exécutent une commande dans le conteneur PHP supposent l'API démarrée (`make up`).

Les scripts pnpm restent utilisables directement (le `Makefile` les appelle) : `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm db:up`, `pnpm db:down`, `pnpm api:up`, `pnpm api:down`, `pnpm api:test`. Drizzle Studio : `pnpm --filter @pokebattle/battle-engine db:studio`.

`pnpm test` (Turborepo) ne lance que les tests Node, qui ont besoin de la base du battle-engine (`make db-up`) : le setup global de Vitest (`apps/battle-engine/test/global-setup.ts`) y applique d'abord les migrations Drizzle en attente, y compris sur la base de dev. Les tests qui lisent les données de combat importent les CSV de `test/fixtures/pokeapi` dans une transaction annulée à la fin : la base de dev n'est jamais modifiée, et les fichiers de test s'exécutent l'un après l'autre (`fileParallelism: false`), car le `TRUNCATE` de l'import verrouille les tables jusqu'au rollback. Les tests PHP passent par `make api-test`.

Les migrations Doctrine sont appliquées automatiquement au démarrage du conteneur (base PostgreSQL `database`, propre à l'API).

### Import des données PokeAPI

`make db-import` télécharge les CSV de PokeAPI (environ 13 Mo) et remplace tout le contenu des tables de données de combat du battle-engine (environ 40 secondes). Pour lire des CSV locaux (par exemple le dossier `data/v2/csv` d'un clone de `PokeAPI/pokeapi`) : `pnpm --filter @pokebattle/battle-engine db:import --dir <dossier>`.

## Services

| Service         | URL en dev               | Détails                                                     |
| --------------- | ------------------------ | ----------------------------------------------------------- |
| `web`           | http://localhost:5173    | Interface utilisateur (`apps/web/app/routes.ts` pour les routes) |
| `battle-engine` | http://localhost:3001    | `GET /health` (200, ou 503 si la base est injoignable), endpoints du simulateur ci-dessous ; variables : voir `apps/battle-engine/.env.example` |
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

### Simulateur de combat (battle-engine)

API sans authentification, appelée uniquement par le serveur web (BFF). Contrats dans `packages/shared` (`pokemon.ts`, `battle.ts`). Les erreurs suivent le format de Fastify (`statusCode`, `error`, `message`).

| Endpoint            | Rôle                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `GET /pokemon`      | Pokémon sélectionnables pour une équipe (environ 1 000, sans pagination) : noms, types, stats de base |
| `GET /pokemon/{id}` | Un Pokémon sélectionnable et les attaques à dégâts qu'il peut apprendre (404 sinon) |
| `POST /battles`     | `{ "team": [{ "pokemonId", "moveIds" }] }` (6 membres, 1 à 4 attaques distinctes chacun) → 201 et la vue du combat contre un bot à équipe aléatoire ; 400 avec `issues` (emplacement et raison) si un Pokémon ou une attaque n'est pas autorisé |
| `GET /battles/{id}` | Vue du combat côté joueur (404 si inconnu) |
| `POST /battles/{id}/actions` | `{ "type": "move", "moveId" }`, `{ "type": "switch", "slot" }` ou `{ "type": "struggle" }` → vue après l'action ; 400 si les règles l'interdisent, 409 si le combat est terminé ou si une autre action a été enregistrée entre-temps |

Un Pokémon est sélectionnable dans sa forme par défaut (ni méga, ni forme alternative ou de combat) s'il peut apprendre au moins une attaque à dégâts, tous jeux confondus. Les attaques de statut ou sans puissance fixe sont exclues tant que le moteur ne gère pas leurs effets.

La vue d'un combat montre toute l'équipe du joueur, mais seulement le Pokémon actif du bot, avec ses PV en pourcentage. Le journal (`log`) liste les événements (`switch`, `move`, `damage`, `faint`…) ; le texte affiché est construit par le web.

#### Règles du combat

Combat simple, en 6 contre 6, contre un bot. Le bot choisit une attaque au hasard parmi celles qui ont des PP. Il ne change jamais de Pokémon de lui-même, et remplace au hasard un Pokémon mis K.O.

- **Pokémon** : niveau 50, IV 31, EV 0, nature neutre. Les talents et les objets n'ont aucun effet.
- **Ordre du tour** : les changements de Pokémon passent en premier, puis les attaques par priorité, puis par vitesse (tirage en cas d'égalité). Un Pokémon mis K.O. avant d'agir n'attaque pas, et le joueur choisit alors son remplaçant (phase `choose-switch`, sans nouveau tour).
- **Dégâts** : formule des générations 5 et suivantes. Coup critique ×1,5 (chance selon le `crit_rate` de l'attaque : 1/24, 1/8, 1/2, puis toujours), aléa de 85 à 100 %, STAB ×1,5, efficacité des types (`type_efficacy`), au moins 1 dégât hors immunité. Une attaque sans précision ne rate jamais.
- **PP et Lutte** : chaque attaque consomme 1 PP. Sans PP, le Pokémon utilise Lutte (puissance 50, sans type, recul d'un quart de ses PV max).
- **Fin** : le combat se termine quand un camp n'a plus de Pokémon ; match nul si les deux derniers tombent au même tour.
- **Pas encore gérés** : effets secondaires et statuts, modifications de stats, attaques multi-coups, drain, recul (hors Lutte), attaques en deux tours, types variables (Téra Explosion reste de type Normal) et PV fixes de Munja.

## Choix techniques

- **pnpm workspaces + Turborepo** : orchestration et cache des tâches `build`, `dev`, `typecheck`, `test`.
- **Biome** : lint et formatage du code TypeScript/JSON, configuré une seule fois à la racine (`biome.json`).
- **Fastify** pour le simulateur : `buildApp()` (`apps/battle-engine/src/app.ts`) construit l'application sans ouvrir de port, les tests passent par `app.inject()` (Vitest).
- **`@fastify/autoload`** (battle-engine) : `app.ts` n'enregistre rien à la main. Chaque fichier de `src/plugins/` est chargé en premier, avec les options de `buildApp()` (dont `databaseUrl`) : ce sont les plugins partagés, exportés par défaut et entourés de `fastify-plugin` pour que leurs décorateurs (`app.db`) soient visibles partout. Chaque fichier de `src/routes/` est ensuite chargé comme plugin de routes encapsulé (export par défaut), préfixé par son dossier : `src/routes/pokemon/index.ts` répond sous `/pokemon`. Autoload importe ces fichiers avec l'`import()` natif de Node, hors de Vite : Vitest charge donc tsx dans ses workers (`execArgv` de `vitest.config.ts`).
- **PostgreSQL + Drizzle** pour les données du simulateur (données de combat importées de PokeAPI, tables dans `src/db/schema.ts`) : base dédiée au battle-engine, conteneurisée ; le serveur Fastify tourne sur l'hôte. Le client est exposé via `app.db` (`src/plugins/db.ts`). Les migrations générées dans `drizzle/` sont commitées et ne se modifient pas à la main.
- **Variables d'environnement** : `.env` (non commité) chargé par `loadDotEnv()` (`src/env.ts`, `process.loadEnvFile` natif) et lu aussi par Docker Compose.
- **Tests non mis en cache** par Turborepo (`turbo.json`) : ils dépendent de l'état de la base. Turborepo filtre par défaut les variables d'environnement (mode strict) : `DATABASE_URL` est déclarée en `passThroughEnv` sur la tâche `test`, sinon celle fournie par la CI n'atteindrait pas les tests.
- **Scripts d'installation** : pnpm 11 les bloque par défaut ; les paquets autorisés sont listés dans `allowBuilds` (`pnpm-workspace.yaml`).
- **React Router v7** (mode framework) généré depuis la branche `v7` de `remix-run/react-router-templates` ; la v8 est sortie mais la v7 est demandée. Le Dockerfile npm du template a été retiré (incompatible avec le monorepo pnpm). Biome analyse les directives Tailwind v4 (`css.parser.tailwindDirectives`).
- **symfony-docker** pour l'API utilisateurs : copié depuis `dunglas/symfony-docker` au commit `4227566` (2026-08-31, sans son historique git), squelette Symfony 8.1 généré par le conteneur au premier démarrage. Sa documentation amont est dans `apps/user-api/README.md` et `apps/user-api/docs/`. Sa CI de template (`.github/`, qui ne s'exécutait pas depuis un sous-dossier) a été remplacée par la CI du dépôt.
- **FrankenPHP fixé en 1.12** (`apps/user-api/Dockerfile`) : la 1.13 embarque Mercure 1.0, incompatible avec la config Mercure du template (le conteneur redémarre en boucle, dunglas/symfony-docker#968). À retirer quand la PR amont #969 sera publiée et reportée ici.
- **API utilisateurs** : API Platform 5 + Doctrine ORM (PostgreSQL), SecurityBundle, LexikJWTAuthenticationBundle, NelmioCorsBundle. La passphrase JWT est dans `.env.local` (non commité) ; `.env.test` contient une passphrase de test non sensible car Symfony ne charge pas `.env.local` en environnement de test.
- **Front en BFF** : le serveur React Router appellera l'API utilisateurs et gardera les tokens dans sa propre session (cookie httpOnly) ; Symfony renvoie donc les tokens dans le corps JSON, sans cookie, et le navigateur n'appelle pas l'API directement.
- **Utilisateurs** : identifiant UUID v7 (non énumérable), email normalisé en minuscules (unicité insensible à la casse), mot de passe haché par `App\State\UserPasswordHasher`, rôles ignorés à l'inscription.
- **Refresh tokens** : GesdinetJWTRefreshTokenBundle v3, usage unique (rotation) et stockage haché en base. Sa détection de réutilisation (`reuse_detection`) n'est pas activée : en 3.0.0 elle empêche le conteneur de se construire (markitosgv/JWTRefreshTokenBundle#434) et reste inopérante avec les tokens hachés (#433). Sa recipe Flex est « contrib », la configuration (`config/packages/gesdinet_jwt_refresh_token.yaml`) est écrite à la main.
- **Tests de l'API utilisateurs** : PHPUnit + `ApiTestCase` (`api-platform/test`), Foundry pour les données, DAMA DoctrineTestBundle (chaque test est annulé par rollback). La recipe DAMA est « contrib » et ignorée par Flex (`allow-contrib` désactivé) : le bundle et l'extension PHPUnit sont enregistrés à la main comme le fait la recipe.
- **Qualité PHP** (API utilisateurs) : PHPStan au niveau max (`phpstan.dist.neon`, extensions Symfony, Doctrine et PHPUnit, sur `src/` et `tests/`) et PHP-CS-Fixer en règles `@Symfony` (`.php-cs-fixer.dist.php`). L'option `allowNullablePropertyForRequiredField` est activée : les entités restent incomplètes jusqu'à la validation d'API Platform, et les colonnes NOT NULL font office de garde-fou. `phpstan/phpstan` est fixé en 2.3.0, car la 2.3.1 avait moins d'un jour à l'installation.
- **Import PokeAPI** (`apps/battle-engine/src/import/`) : depuis les CSV du dépôt `PokeAPI/pokeapi`, épinglés sur un commit (`POKEAPI_REF` dans `source.ts`, à changer pour récupérer des données plus récentes). Ces CSV sont la source de la base de PokeAPI, et le script n'envoie qu'une trentaine de requêtes, contre plusieurs milliers avec l'API REST. Le script importe tous les Pokémon et leurs formes (méga, régionales, alternatives), les espèces, les types et la table des types, les statistiques, les natures, les talents de la série principale, les attaques avec leurs métadonnées de combat, les learnsets de toutes les versions, ainsi que les baies et les objets tenus (sélectionnés par catégorie, car les drapeaux `holdable` de PokeAPI sont incomplets). Les noms sont importés en français et en anglais, avec le texte d'effet court. Les entrées hors série principale (types inconnu et Obscur, attaques Obscures de Colosseum) sont exclues. L'import se fait en une seule transaction : `TRUNCATE` puis insertions par lots. En cas d'échec, l'import précédent reste en place. Le `TRUNCATE` est sans `CASCADE`, si bien qu'une future table qui référencerait ces données ferait échouer l'import au lieu d'être vidée. Limites de PokeAPI : 93 attaques récentes (Légendes Arceus, génération 9) n'ont pas de métadonnées de combat (colonnes à `NULL`), certains noms et textes manquent (colonnes à `NULL`), et les effets des talents et objets ne sont décrits qu'en texte.
- **Combats** (battle-engine) : le moteur (`src/battle/`) est pur. Il reçoit l'état et une action, et rend le nouvel état. L'état est un document JSON (table `battles`, colonne `state`) qui copie les données de référence utiles : un nouvel import PokeAPI ne modifie pas un combat en cours, et la table n'a aucune clé étrangère vers les tables importées. Chaque mise à jour vérifie la colonne `version` (verrou optimiste) : de deux actions simultanées, la seconde reçoit 409. Le hasard vient d'un générateur à graine (mulberry32) dont l'état est stocké avec le combat. Un tour est donc rejouable, et les tests fixent chaque tirage. Les combats terminés ne sont pas encore purgés.
- **Dépendance `csv-parse`** (battle-engine) : les CSV de PokeAPI contiennent des champs entre guillemets avec virgules et retours à la ligne.
- **TypeScript 6** : la v7 n'est pas encore supportée par les outils de React Router v7.
