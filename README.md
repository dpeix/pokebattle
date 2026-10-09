# pokebattle

Simulateur de combat web, organisé en monorepo pnpm + Turborepo.

## Prérequis

- Node.js 24 (`.nvmrc`)
- pnpm 11 (version fixée par `packageManager` dans `package.json`)
- Docker + Docker Compose

## Structure

```
apps/
  battle-engine/  # @pokebattle/battle-engine : API Fastify du simulateur de combat (port 3001)
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

## Services

| Service         | URL en dev               | Détails                                                     |
| --------------- | ------------------------ | ----------------------------------------------------------- |
| `battle-engine` | http://localhost:3001    | `GET /health` ; variables : voir `apps/battle-engine/.env.example` |

## Choix techniques

- **pnpm workspaces + Turborepo** : orchestration et cache des tâches `build`, `dev`, `typecheck`, `test`.
- **Biome** : lint et formatage du code TypeScript/JSON, configuré une seule fois à la racine (`biome.json`).
- **Fastify** pour le simulateur : `buildApp()` (`apps/battle-engine/src/app.ts`) construit l'application sans ouvrir de port, les tests passent par `app.inject()` (Vitest).
- **Scripts d'installation** : pnpm 11 les bloque par défaut ; les paquets autorisés sont listés dans `allowBuilds` (`pnpm-workspace.yaml`).
- **TypeScript 6** : la v7 n'est pas encore supportée par les outils de React Router v7.
