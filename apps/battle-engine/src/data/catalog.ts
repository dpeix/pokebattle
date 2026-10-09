// Reference data queries: the Pokémon and moves a team may use. A Pokémon
// is selectable in its default form (no megas or alternate forms) when it
// can learn at least one damaging move, in any game; status moves are left
// out until the engine handles their effects.
import type {
  BattleStats,
  LearnableMove,
  Named,
  PokemonDetail,
  PokemonSummary,
} from "@pokebattle/shared";
import { and, asc, eq, exists, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { names } from "../battle/engine.js";
import type { BattleType, MoveInput } from "../battle/types.js";
import type { DbClient } from "../db/client.js";
import { moves, pokemon, pokemonMoves, types } from "../db/schema.js";

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
