# pokebattle

Simulateur de combat web, organisé en monorepo pnpm + Turborepo.

## Prérequis

- Node.js 24 (`.nvmrc`)
- pnpm 11 (version fixée par `packageManager` dans `package.json`)
- Docker + Docker Compose

## Structure

```
apps/
packages/
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

## Choix techniques

- **pnpm workspaces + Turborepo** : orchestration et cache des tâches `build`, `dev`, `typecheck`, `test`.
- **Biome** : lint et formatage du code TypeScript/JSON, configuré une seule fois à la racine (`biome.json`).
- **TypeScript 6** : la v7 n'est pas encore supportée par les outils de React Router v7.
