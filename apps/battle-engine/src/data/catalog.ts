// Reference data queries: the Pokémon and moves a team may use. A Pokémon
// is selectable in its default form (no megas or alternate forms) when it
// can learn at least one damaging move, in any game; status moves are left
// out until the engine handles their effects.
import {
  type BattleStats,
  type LearnableMove,
  MAX_MOVES_PER_POKEMON,
  type Named,
  type PokemonDetail,
  type PokemonSummary,
  type TeamIssue,
  type TeamMemberInput,
} from "@pokebattle/shared";
import { and, asc, eq, exists, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { names } from "../battle/engine.js";
import type { Random } from "../battle/random.js";
import type {
  BattlerInput,
  BattleType,
  MoveInput,
  TypeChart,
} from "../battle/types.js";
import type { DbClient } from "../db/client.js";
import {
  moves,
  pokemon,
  pokemonMoves,
  typeEfficacy,
  types,
} from "../db/schema.js";

const type1 = alias(types, "type1");
const type2 = alias(types, "type2");

/** A selectable Pokémon, with what a battle needs to know about it. */
export interface CatalogPokemon extends Named {
  id: number;
  types: BattleType[];
  baseStats: BattleStats;
}

const isDamaging = () =>
  and(ne(moves.damageClass, "status"), isNotNull(moves.power));

function isSelectable(db: DbClient) {
  return and(
    eq(pokemon.isDefault, true),
    eq(pokemon.isBattleOnly, false),
    exists(
      db
        .select({ one: sql`1` })
        .from(pokemonMoves)
        .innerJoin(moves, eq(moves.id, pokemonMoves.moveId))
        .where(and(eq(pokemonMoves.pokemonId, pokemon.id), isDamaging())),
    ),
  );
}

function battleType(row: typeof types.$inferSelect): BattleType {
  return {
    id: row.id,
    identifier: row.identifier,
    nameFr: row.nameFr,
    nameEn: row.nameEn,
  };
}

/** The selectable Pokémon among `ids` (all of them without `ids`), by id. */
export async function findSelectablePokemon(
  db: DbClient,
  ids?: number[],
): Promise<CatalogPokemon[]> {
  const rows = await db
    .select({ pokemon, type1, type2 })
    .from(pokemon)
    .innerJoin(type1, eq(type1.id, pokemon.type1Id))
    .leftJoin(type2, eq(type2.id, pokemon.type2Id))
    .where(
      and(
        isSelectable(db),
        ids === undefined ? undefined : inArray(pokemon.id, ids),
      ),
    )
    .orderBy(asc(pokemon.id));
  return rows.map((row) => ({
    id: row.pokemon.id,
    identifier: row.pokemon.identifier,
    nameFr: row.pokemon.nameFr,
    nameEn: row.pokemon.nameEn,
    types: [row.type1, row.type2].flatMap((type) =>
      type === null ? [] : [battleType(type)],
    ),
    baseStats: {
      hp: row.pokemon.hp,
      attack: row.pokemon.attack,
      defense: row.pokemon.defense,
      specialAttack: row.pokemon.specialAttack,
      specialDefense: row.pokemon.specialDefense,
      speed: row.pokemon.speed,
    },
  }));
}

/** The damaging moves each of `pokemonIds` can learn, by move id. */
export async function findLearnableMoves(
  db: DbClient,
  pokemonIds: number[],
): Promise<Map<number, MoveInput[]>> {
  const rows = await db
    .selectDistinct({
      pokemonId: pokemonMoves.pokemonId,
      id: moves.id,
      identifier: moves.identifier,
      nameFr: moves.nameFr,
      nameEn: moves.nameEn,
      type: types,
      power: moves.power,
      accuracy: moves.accuracy,
      priority: moves.priority,
      damageClass: moves.damageClass,
      critRate: moves.critRate,
      pp: moves.pp,
    })
    .from(pokemonMoves)
    .innerJoin(moves, eq(moves.id, pokemonMoves.moveId))
    .innerJoin(types, eq(types.id, moves.typeId))
    .where(and(inArray(pokemonMoves.pokemonId, pokemonIds), isDamaging()))
    .orderBy(asc(pokemonMoves.pokemonId), asc(moves.id));

  const learnable = new Map<number, MoveInput[]>();
  for (const row of rows) {
    const { pokemonId, type, power, damageClass, critRate, ...move } = row;
    // Both excluded by isDamaging(); checked again for the types.
    if (power === null || damageClass === "status") {
      continue;
    }
    if (damageClass !== "physical" && damageClass !== "special") {
      throw new Error(
        `move ${move.id} has an unknown damage class: ${damageClass}`,
      );
    }
    const known = learnable.get(pokemonId) ?? [];
    known.push({
      ...move,
      type: battleType(type),
      power,
      damageClass,
      // Null when PokeAPI has no battle metadata for the move.
      critRate: critRate ?? 0,
    });
    learnable.set(pokemonId, known);
  }
  return learnable;
}

function toSummary(entry: CatalogPokemon): PokemonSummary {
  return {
    id: entry.id,
    ...names(entry),
    types: entry.types.map(names),
    baseStats: entry.baseStats,
  };
}

function toLearnableMove(move: MoveInput): LearnableMove {
  if (move.type === null) {
    throw new Error(`move ${move.id} has no type`);
  }
  return {
    id: move.id,
    ...names(move),
    type: names(move.type),
    power: move.power,
    accuracy: move.accuracy,
    pp: move.pp,
    priority: move.priority,
    damageClass: move.damageClass,
  };
}

export async function listSelectablePokemon(
  db: DbClient,
): Promise<PokemonSummary[]> {
  return (await findSelectablePokemon(db)).map(toSummary);
}

/** Undefined when the Pokémon does not exist or is not selectable. */
export async function findPokemonDetail(
  db: DbClient,
  id: number,
): Promise<PokemonDetail | undefined> {
  const [entry] = await findSelectablePokemon(db, [id]);
  if (entry === undefined) {
    return undefined;
  }
  const learnable = await findLearnableMoves(db, [id]);
  return {
    ...toSummary(entry),
    moves: (learnable.get(id) ?? []).map(toLearnableMove),
  };
}

function toBattlerInput(
  entry: CatalogPokemon,
  moves: MoveInput[],
): BattlerInput {
  return {
    pokemonId: entry.id,
    ...names(entry),
    types: entry.types,
    baseStats: entry.baseStats,
    moves,
  };
}

/**
 * Checks the player's team against the catalog. The JSON Schema of the
 * route already checked its shape (size, 1 to 4 distinct moves).
 */
export async function loadTeam(
  db: DbClient,
  team: TeamMemberInput[],
): Promise<{ battlers: BattlerInput[] } | { issues: TeamIssue[] }> {
  const pokemonIds = [...new Set(team.map((member) => member.pokemonId))];
  const catalog = new Map(
    (await findSelectablePokemon(db, pokemonIds)).map((entry) => [
      entry.id,
      entry,
    ]),
  );
  const learnable = await findLearnableMoves(db, [...catalog.keys()]);

  const battlers: BattlerInput[] = [];
  const issues: TeamIssue[] = [];
  team.forEach((member, slot) => {
    const entry = catalog.get(member.pokemonId);
    if (entry === undefined) {
      issues.push({
        slot,
        reason: "pokemon-not-allowed",
        pokemonId: member.pokemonId,
      });
      return;
    }
    const known = learnable.get(entry.id) ?? [];
    const moves: MoveInput[] = [];
    for (const moveId of member.moveIds) {
      const move = known.find((candidate) => candidate.id === moveId);
      if (move === undefined) {
        issues.push({ slot, reason: "move-not-allowed", moveId });
      } else {
        moves.push(move);
      }
    }
    battlers.push(toBattlerInput(entry, moves));
  });
  return issues.length > 0 ? { issues } : { battlers };
}

/**
 * A random team: `size` selectable Pokémon (the same one may come twice),
 * each with up to 4 random moves among those it can learn.
 */
export async function pickRandomTeam(
  db: DbClient,
  random: Random,
  size: number,
): Promise<BattlerInput[]> {
  const candidates = await db
    .select({ id: pokemon.id })
    .from(pokemon)
    .where(isSelectable(db))
    .orderBy(asc(pokemon.id));
  if (candidates.length === 0) {
    throw new Error("no selectable Pokémon: is the PokeAPI data imported?");
  }
  const pickedIds = Array.from({ length: size }, () => {
    const candidate = candidates[random.int(0, candidates.length - 1)];
    if (candidate === undefined) {
      throw new Error("random pick out of the candidates");
    }
    return candidate.id;
  });
  const catalog = new Map(
    (await findSelectablePokemon(db, pickedIds)).map((entry) => [
      entry.id,
      entry,
    ]),
  );
  const learnable = await findLearnableMoves(db, [...catalog.keys()]);

  return pickedIds.map((id) => {
    const entry = catalog.get(id);
    if (entry === undefined) {
      throw new Error(`Pokémon ${id} is no longer selectable`);
    }
    const moves = [...(learnable.get(id) ?? [])];
    // Partial Fisher-Yates shuffle: the first moves become a random pick.
    const count = Math.min(MAX_MOVES_PER_POKEMON, moves.length);
    for (let index = 0; index < count; index++) {
      const swap = random.int(index, moves.length - 1);
      [moves[index], moves[swap]] = [
        moves[swap] as MoveInput,
        moves[index] as MoveInput,
      ];
    }
    return toBattlerInput(entry, moves.slice(0, count));
  });
}

export async function loadTypeChart(db: DbClient): Promise<TypeChart> {
  const rows = await db.select().from(typeEfficacy);
  const factors = new Map(
    rows.map((row) => [
      `${row.attackingTypeId}:${row.defendingTypeId}`,
      row.damageFactor / 100,
    ]),
  );
  return (attacking, defending) =>
    factors.get(`${attacking}:${defending}`) ?? 1;
}
