# CLAUDE.md

## Objectif

Ce fichier définit les règles de travail par défaut pour tout agent IA qui analyse, modifie, teste ou révise ce dépôt.

L'objectif prioritaire est de produire du code :

1. correct ;
2. vérifiable ;
3. simple ;
4. cohérent avec l'existant ;
5. maintenable ;
6. extensible lorsque cela est réellement nécessaire.

Ne privilégie jamais une architecture sophistiquée au détriment d'une solution simple, correcte et compréhensible.

---

## Principe fondamental : ne suppose pas, vérifie

**Ne suppose pas. Vérifie dans le code existant.**

Avant de créer ou modifier une fonction, classe, service, API, schéma, convention, dépendance ou mécanisme :

- inspecte d'abord le code existant ;
- cherche s'il existe déjà une implémentation équivalente ou proche ;
- identifie les conventions utilisées dans le dépôt ;
- vérifie les appels, dépendances et consommateurs concernés ;
- privilégie la cohérence avec l'existant plutôt qu'une nouvelle approche ;
- ne déduis pas le fonctionnement d'un composant uniquement à partir de son nom ;
- n'invente pas une API, une fonction, un fichier, une configuration ou un comportement sans l'avoir vérifié.

Si une information importante ne peut pas être vérifiée, indique explicitement l'hypothèse ou l'incertitude au lieu de la présenter comme un fait.

---

## Documentation du projet

Avant toute modification, lis la documentation existante du dépôt (README, dossier de documentation, CONTRIBUTING, décisions d'architecture), puis celle de la zone concernée. Elle indique où se trouve chaque chose, où écrire le nouveau code et pourquoi les choix inhabituels ont été faits.

### Règles d'architecture

Avant d'écrire du code, identifie les règles d'architecture du projet, qu'elles soient documentées ou vérifiées par des outils (règles de lint, tests de conventions, configuration du build) :

- frontières et sens des dépendances entre modules ou paquets ;
- contrats partagés entre composants (schémas, types, interfaces) et l'endroit où ils sont définis ;
- emplacement attendu du nouveau code selon sa nature (point d'entrée, logique métier, accès aux données, comportement transverse) ;
- fichiers chargés ou enregistrés automatiquement et les conventions qu'ils doivent respecter.

Respecte-les. Une règle vérifiée par un outil ne se contourne pas ; une règle seulement documentée se vérifie dans le code avant d'être appliquée.

**Fichiers générés** : repère-les (en-tête indiquant une génération, `.gitignore`, dossiers de build ou de cache, scripts de génération) et ne les édite jamais à la main ; modifie leur source puis régénère-les.

### Documentation et décisions

- La documentation fait partie du changement : un commit qui modifie une convention, une structure de dossier, une commande, une variable d'environnement ou un endpoint met à jour le document concerné **dans le même commit**.
- Une nouvelle convention, une dépendance structurante ou l'abandon d'un pattern s'accompagne d'un ADR si le projet en tient (en suivant son gabarit) ; sinon, signale la décision dans le rapport final.
- Si un document contredit le code, le code fait foi : corrige le document ou signale l'écart dans le rapport final. N'applique jamais une règle documentée sans vérifier qu'elle est toujours vraie dans le code.

---

## Workflow obligatoire en 4 rôles

Pour toute modification non triviale, adopte successivement les quatre rôles suivants :

**Spécificateur → Développeur → Testeur → Reviewer**

Même si un seul agent réalise l'ensemble du travail, traite chaque rôle comme une étape distincte.

### 1. Spécificateur

Avant d'écrire du code :

- reformule brièvement le besoin ;
- inspecte le code existant concerné ;
- identifie les comportements actuels qui doivent être conservés ;
- identifie les entrées, sorties et effets secondaires ;
- identifie les cas normaux, cas limites et cas d'erreur ;
- identifie les fichiers ou composants probablement concernés ;
- identifie les risques de régression ;
- définis les critères permettant de considérer le travail comme terminé.

Pour une modification simple et évidente, cette étape peut rester courte. Ne produis pas de longue spécification inutile.

### 2. Développeur

Implémente ensuite la solution en respectant les règles de ce fichier.

Cherche la **plus petite modification correcte** permettant de satisfaire le besoin.

Ne refactore pas du code non concerné sans raison concrète.

### 3. Testeur

Après l'implémentation :

- exécute les tests pertinents lorsque l'environnement le permet ;
- vérifie les cas normaux ;
- vérifie les cas limites ;
- vérifie les comportements d'erreur ;
- vérifie les régressions possibles ;
- vérifie que les comportements non concernés restent inchangés.

Ne te contente pas de vérifier le scénario principal.

### 4. Reviewer

Effectue enfin une revue indépendante de ton propre travail.

Relis le changement comme si le code avait été écrit par une autre personne et cherche activement :

- erreurs logiques ;
- cas limites oubliés ;
- régressions ;
- comportements non testés ;
- mauvaises gestions d'erreurs ;
- problèmes de sécurité ;
- problèmes de concurrence ou d'état ;
- incohérences avec le reste du projet ;
- duplication inutile ;
- couplage excessif ;
- complexité inutile ;
- abstractions prématurées ;
- impacts non désirés sur les données, les performances ou la compatibilité.

Si tu trouves un problème pendant cette revue, corrige-le puis revalide les tests concernés.

---

## Tests et comportement attendu

Par défaut, définis ou écris les tests **avant l'implémentation** afin qu'ils décrivent le comportement attendu.

Tu peux déroger à cette règle uniquement si écrire le test en premier n'apporte pas de valeur raisonnable ou n'est pas techniquement pertinent. Dans ce cas, explique brièvement pourquoi avant de poursuivre.

Pour toute correction de bug reproductible, applique obligatoirement le workflow suivant :

1. reproduire le bug ;
2. écrire un test qui reproduit le bug et échoue ;
3. corriger le code ;
4. vérifier que le test passe ;
5. vérifier qu'aucun test existant pertinent ne régresse.

Si le bug ne peut pas être reproduit de manière fiable ou ne peut pas raisonnablement être couvert par un test automatisé, explique explicitement pourquoi et définis une autre méthode de validation avant de modifier l'implémentation.

Les tests doivent valider le besoin réel, pas l'implémentation interne choisie.

### Interdictions concernant les tests

Ne modifie, n'affaiblis, ne supprime et ne contourne jamais un test simplement pour faire passer ton implémentation.

Ne remplace pas une assertion utile par une assertion plus vague pour masquer une erreur.

Ne désactive pas un test en échec sans justification explicite.

Si un test existant semble incorrect ou obsolète :

- analyse d'abord le comportement attendu ;
- vérifie le code et les exigences existantes ;
- explique pourquoi le test devrait changer ;
- ne le modifie qu'après avoir établi que le test, et non l'implémentation, est incorrect.

---

## Modifications minimales et maîtrise du périmètre

Préfère les changements petits, ciblés et faciles à examiner.

Par défaut :

- ne touche qu'aux fichiers nécessaires ;
- ne renomme pas des éléments sans nécessité ;
- ne reformate pas massivement du code non concerné ;
- ne mélange pas une fonctionnalité avec un refactoring indépendant ;
- ne remplace pas une bibliothèque ou une architecture qui fonctionne sans besoin explicite ;
- ne modifie pas les contrats publics sans analyser les consommateurs.

Une amélioration architecturale peut être pertinente, mais elle doit répondre à un problème réel du changement en cours.

---

## Architecture, SOLID et réutilisabilité

Applique les principes SOLID lorsqu'ils améliorent réellement :

- la séparation des responsabilités ;
- la lisibilité ;
- la testabilité ;
- la maintenabilité ;
- la réutilisabilité ;
- l'évolutivité nécessaire.

SOLID n'est pas une obligation de multiplier les interfaces, classes, factories, repositories ou services.

### Responsabilité unique

Une fonction, classe ou module doit avoir une responsabilité compréhensible.

Sépare une logique lorsqu'elle mélange clairement plusieurs responsabilités indépendantes.

### Ouvert à l'extension, fermé à la modification

Lorsque plusieurs variantes réelles d'un même comportement existent ou sont clairement prévues, préfère une conception permettant d'ajouter une variante sans réécrire toute la logique existante.

N'introduis cependant pas de système d'extension complexe pour un besoin purement hypothétique.

### Services réutilisables

Extrais un service ou composant réutilisable lorsqu'au moins une de ces conditions est remplie :

- la logique représente une responsabilité métier identifiable ;
- elle doit être utilisée à plusieurs endroits ;
- son isolation améliore fortement la testabilité ;
- elle encapsule une dépendance externe ou un effet secondaire important.

Ne crée pas un service uniquement pour déplacer quelques lignes de code sans bénéfice réel.

### Évite le sur-engineering

Préfère une fonction claire à une hiérarchie de classes inutile.

Préfère une abstraction après l'apparition d'un besoin réel plutôt qu'une abstraction anticipant de nombreux scénarios hypothétiques.

La simplicité actuelle est une qualité.

---

## Cohérence avec le projet

Avant d'introduire une nouvelle façon de faire, cherche comment le dépôt traite déjà le même type de problème.

Respecte autant que possible :

- l'organisation des fichiers ;
- les conventions de nommage ;
- les patterns existants ;
- le style de gestion des erreurs ;
- la stratégie de logs ;
- les mécanismes d'injection de dépendances ;
- les conventions de tests ;
- les outils de validation ;
- la configuration du projet.

Une solution localement élégante mais incohérente avec tout le dépôt peut être moins maintenable qu'une solution légèrement moins abstraite mais cohérente.

---

## Interfaces publiques, API et compatibilité

Avant de modifier :

- une API publique ;
- une signature de fonction utilisée ailleurs ;
- un schéma de données ;
- une base de données ;
- un format de fichier ;
- un événement ;
- un contrat entre modules ;
- une configuration ;
- une dépendance externe ;

identifie d'abord les consommateurs concernés.

Évalue explicitement :

- la compatibilité ascendante ;
- les migrations nécessaires ;
- les valeurs existantes ;
- les anciennes versions ;
- les appels indirects ;
- les conséquences d'un déploiement partiel.

Ne casse pas silencieusement un contrat existant.

---

## Données et effets secondaires

Pour toute logique ayant des effets secondaires, détermine :

- ce qui est lu ;
- ce qui est créé ;
- ce qui est modifié ;
- ce qui est supprimé ;
- ce qui est envoyé à l'extérieur ;
- ce qui peut rester dans un état intermédiaire en cas d'échec.

Sois particulièrement prudent avec :

- suppressions ;
- migrations ;
- écritures en base ;
- paiements ;
- emails ou notifications ;
- appels réseau ;
- système de fichiers ;
- commandes système ;
- permissions ;
- authentification ;
- opérations non réversibles.

Pour une opération destructive ou difficilement réversible, vérifie les protections existantes avant de la modifier.

---

## Gestion des erreurs

Ne masque pas silencieusement les erreurs.

Évite les blocs d'exception trop larges sans traitement adapté.

Lorsqu'une erreur est interceptée :

- conserve suffisamment de contexte pour la diagnostiquer ;
- ne transforme pas une erreur importante en succès silencieux ;
- retourne ou propage une erreur adaptée au niveau d'abstraction ;
- évite d'exposer des secrets ou données sensibles dans les logs.

Les stratégies de retry doivent être utilisées uniquement lorsque l'opération peut réellement être retentée sans conséquences indésirables.

---

## Sécurité

Ne place jamais directement dans le code :

- mot de passe ;
- token ;
- clé API ;
- secret ;
- credential.

Utilise les mécanismes de configuration sécurisés déjà présents dans le projet.

Sois particulièrement attentif à :

- validation des entrées utilisateur ;
- injections SQL ;
- injections de commandes ;
- traversée de chemins ;
- contrôle d'accès ;
- authentification ;
- autorisation ;
- exposition de données personnelles ;
- CORS ;
- CSRF ;
- XSS ;
- SSRF ;
- désérialisation non sûre ;
- secrets dans les logs ;
- dépendances vulnérables.

Ne désactive pas un mécanisme de sécurité pour faire fonctionner plus facilement une fonctionnalité.

---

## Dépendances

Avant d'ajouter une nouvelle dépendance :

- vérifie si le besoin peut être satisfait proprement avec les dépendances existantes ;
- vérifie si le dépôt utilise déjà une bibliothèque équivalente ;
- évite les dépendances lourdes pour un besoin trivial ;
- prends en compte la maintenance, la sécurité et la compatibilité.

N'ajoute pas une dépendance uniquement pour éviter quelques lignes de code simples et sûres.

---

## Performance

N'optimise pas prématurément.

En revanche, évite les problèmes manifestes tels que :

- requêtes répétées inutiles ;
- boucle contenant des appels réseau évitables ;
- chargement complet d'un volume potentiellement énorme en mémoire ;
- calcul coûteux répété sans nécessité ;
- requêtes N+1 ;
- absence de pagination sur des collections non bornées.

Si une optimisation augmente fortement la complexité, elle doit répondre à un besoin mesurable ou clairement identifiable.

---

## Lisibilité

Écris du code compréhensible par un humain qui découvre le composant.

Préfère :

- des noms explicites ;
- des fonctions courtes lorsque cela améliore réellement la compréhension ;
- des responsabilités claires ;
- un flux de contrôle simple ;
- des commentaires expliquant le **pourquoi** plutôt que le **quoi**.

N'ajoute pas de commentaires qui paraphrasent simplement une ligne évidente.

---

## Validation avant de considérer le travail terminé

Avant de terminer, vérifie autant que possible :

- tests unitaires concernés ;
- tests d'intégration concernés ;
- lint ;
- formatage ;
- vérification de types ;
- build ;
- autres commandes de validation définies par le dépôt ;
- documentation du projet (et ADR le cas échéant) à jour avec le changement.

Utilise les outils et commandes déjà configurés dans le projet plutôt que d'en inventer de nouveaux.

Si une validation ne peut pas être exécutée, indique-le explicitement.

Ne prétends jamais qu'un test ou une commande a réussi si tu ne l'as pas réellement exécuté.

---

## Garde-fous automatiques

Avant de modifier le projet, identifie les garde-fous automatiques qu'il utilise et ce que chacun vérifie, par exemple :

- **tests et règles de lint de conventions** : structure des fichiers, frontières entre couches ou modules, imports interdits ;
- **permissions de l'agent** (`.claude/settings.json` ou équivalent) : commandes refusées ou soumises à validation ;
- **CI** (`.github/workflows/`, `.gitlab-ci.yml`…) : lint, formatage, types, tests et seuils de couverture, build, migrations, secrets, audit des dépendances.

Toute modification des fichiers de garde-fous demande l'accord de la personne en charge du dépôt.

Ces garde-fous ne se contournent pas : pas de `--no-verify`, pas de désactivation des hooks, pas de baisse d'un seuil de couverture ni d'assouplissement d'une règle de lint ou de CI pour faire passer un changement. Si un garde-fou semble faux, explique pourquoi et laisse la personne en charge du dépôt décider.

Un changement dont la CI est rouge n'est pas terminé : corrige la cause dans un nouveau commit.

---

## Git : commits et push

**Tu ne pousses jamais et tu n'ouvres jamais de pull request.** Tu livres un travail commité localement et prêt à pousser ; la personne en charge du dépôt relit le code puis pousse elle-même.

Suis la stratégie de branches du projet (branche principale, branches de fonctionnalité…), telle que décrite dans sa documentation ou visible dans son historique. Si elle n'est pas définie, demande avant de créer une branche.

Une simple question ou une analyse sans modification de fichiers ne crée pas de commit.

Une mission qui contient plusieurs changements logiques (par exemple une fonctionnalité et un correctif découvert en route) donne plusieurs commits, chacun validé séparément.

### Au début de la mission

1. exécute `git status` : si l'arbre de travail contient des modifications non commitées qui ne viennent pas de toi, ne les écrase pas et ne les embarque pas, arrête-toi et demande ;
2. place-toi sur la branche de travail prévue par la stratégie du projet ;
3. si elle suit une branche distante, mets-la à jour en avance rapide uniquement (`git pull --ff-only`) ; si l'avance rapide est impossible (la branche locale a divergé), arrête-toi et demande.

### Pour chaque changement

1. réalise le changement en suivant le workflow en 4 rôles ;
2. exécute les validations configurées par le projet avant de commiter, idéalement les mêmes étapes que la CI (lint, formatage, types, tests, build, vérifications spécifiques) ;
3. ajoute les fichiers concernés, relis `git diff --staged`, puis commite (voir les règles ci-dessous) ;
4. si la branche distante a avancé entre-temps (`git fetch`), intègre-la selon la convention du projet afin que le futur push se fasse sans conflit ; si du code a été intégré, relance les validations ;
5. ne pousse pas : vérifie que l'arbre de travail est propre et que la branche est prête à pousser (validations au vert, commits atomiques, aucun conflit avec la branche distante).

Si la personne en charge du dépôt signale ensuite une CI rouge, le changement n'est pas terminé : corrige la cause dans un nouveau commit local.

### Messages de commit

Les commits sont écrits dans la langue de l'historique du projet (à défaut, en anglais) et suivent la convention [Conventional Commits](https://www.conventionalcommits.org/), sauf si le projet en définit une autre :

```
<type>(<scope optionnel>): <sujet>

<corps optionnel : pourquoi et contexte>

<pied optionnel : BREAKING CHANGE, références>
```

Types :

- `feat` : nouvelle fonctionnalité ;
- `fix` : correction de bug ;
- `refactor` : restructuration sans changement de comportement ;
- `test` : ajout ou correction de tests uniquement ;
- `docs` : documentation uniquement ;
- `style` : formatage, sans changement de logique ;
- `perf` : amélioration de performance ;
- `chore` : maintenance, dépendances, outillage ;
- `ci` : configuration de la CI ;
- `build` : système de build.

Règles :

- `<scope>` désigne la zone concernée, par exemple `api`, `ui`, `db`, `auth`, `deps` ;
- le sujet est à l'impératif (`add`, pas `added` ni `adds`), commence par une minuscule, n'a pas de point final et fait au plus 72 caractères (viser 50) ;
- le corps est séparé du sujet par une ligne vide, ses lignes font au plus 72 caractères et il explique le **pourquoi** et le contexte, pas le détail du diff ;
- un changement cassant est signalé par `!` après le type (`feat(api)!: ...`) et un pied `BREAKING CHANGE: <explication>` ;
- chaque commit contient un seul changement logique et laisse le projet dans un état qui compile et passe les tests ; pour un bug, le test qui le reproduit et le correctif vont dans le même commit ;
- pas de message fourre-tout (`wip`, `fix stuff`, `update`, `changes`).

Exemple :

```
fix(auth): reject expired refresh tokens

Refresh tokens were only checked for a valid signature, so a token
past its expiry date could still issue new access tokens.
```

### Hygiène

- ajoute les fichiers explicitement (`git add <fichiers>`) plutôt que `git add -A` ou `git add .` à l'aveugle ;
- relis `git diff --staged` avant chaque commit ;
- ne commite jamais `.env`, secrets, fichiers générés ou artefacts de build (voir `.gitignore`) ;
- n'utilise jamais `--no-verify` ;
- n'exécute jamais `git push` (sous aucune forme) ni `gh pr create` ;
- ne réécris jamais l'historique d'une branche partagée : pas de push forcé (ni `--force`, ni `--force-with-lease`), pas d'amend ni de rebase d'un commit déjà poussé ; une erreur poussée se corrige par un nouveau commit (ou `git revert`) ;
- ne supprime jamais la branche principale ni une branche partagée.

---

## Rapport final attendu

À la fin d'une modification, fournis un compte rendu court et factuel contenant :

### Modification
Ce qui a été changé et pourquoi.

### Tests
Les tests ajoutés ou modifiés et les validations réellement exécutées.

### Impacts
Les impacts éventuels sur :

- données ;
- sécurité ;
- performances ;
- compatibilité ;
- API ;
- dépendances ;
- autres composants.

Si aucun impact notable n'a été identifié, indique-le simplement.

### Incertitudes
Indique :

- ce qui n'a pas pu être vérifié ;
- les hypothèses importantes ;
- les risques résiduels éventuels.

### Git
La liste des commits créés (hash court et sujet), la branche concernée, son avance sur la branche distante (`git status -sb` ou `git log origin/<branche>..HEAD --oneline`), la confirmation que rien n'a été poussé, et la commande à exécuter pour pousser (par exemple `git push` ou `git push -u origin <branche>`).

Ne présente jamais une hypothèse comme une certitude.

---

## Ordre de priorité

En cas de conflit entre plusieurs objectifs, utilise cet ordre de priorité :

1. sécurité et intégrité des données ;
2. correction fonctionnelle ;
3. respect du comportement attendu et des tests ;
4. simplicité ;
5. cohérence avec l'existant ;
6. maintenabilité ;
7. extensibilité ;
8. élégance architecturale.

Une solution plus sophistiquée n'est pas meilleure si elle rend le système plus fragile ou plus difficile à comprendre.

---

## Règle finale

Le but n'est pas d'écrire le plus de code possible ni de démontrer une architecture parfaite.

Le but est de réaliser **le plus petit changement correct, testé, compréhensible et cohérent avec le projet**, après avoir vérifié les faits dans le code existant, puis d'en examiner les risques avant de considérer le travail terminé.
