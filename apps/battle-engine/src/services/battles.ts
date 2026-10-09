// Battles against the bot: loads the reference data and the stored state,
// lets the engine play, and stores the result.
import { randomInt } from "node:crypto";
import {
  type BattleAction,
  type BattleView,
  TEAM_SIZE,
  type TeamIssue,
  type TeamMemberInput,
} from "@pokebattle/shared";
import { applyAction, createBattleState } from "../battle/engine.js";
import { createRandom } from "../battle/random.js";
import { toBattleView } from "../battle/view.js";
import { findBattle, insertBattle, updateBattle } from "../data/battles.js";
import { loadTeam, loadTypeChart, pickRandomTeam } from "../data/catalog.js";
import type { DbClient } from "../db/client.js";

export class BattleNotFoundError extends Error {
  constructor(id: string) {
    super(`battle ${id} not found`);
    this.name = "BattleNotFoundError";
  }
}

/** Another action on the same battle was stored first. */
export class BattleConflictError extends Error {
  constructor(id: string) {
    super(`battle ${id} was updated by another action`);
    this.name = "BattleConflictError";
  }
}

const MAX_SEED = 2 ** 32;

/** Without a `seed`, the bot's team and the whole battle are unpredictable. */
export async function createBattle(
  db: DbClient,
  team: TeamMemberInput[],
  seed: number = randomInt(MAX_SEED),
): Promise<{ view: BattleView } | { issues: TeamIssue[] }> {
  const player = await loadTeam(db, team);
  if ("issues" in player) {
    return player;
  }
  const random = createRandom(seed);
  const opponent = await pickRandomTeam(db, random, TEAM_SIZE);
  const state = createBattleState(player.battlers, opponent, random.state());
  const id = await insertBattle(db, state);
  return { view: toBattleView(id, state) };
}

export async function getBattle(
  db: DbClient,
  id: string,
): Promise<BattleView | undefined> {
  const stored = await findBattle(db, id);
  return stored === undefined ? undefined : toBattleView(id, stored.state);
}

/**
 * @throws BattleNotFoundError, BattleConflictError, or the engine's
 * BattleRuleError when the action is not allowed.
 */
export async function playAction(
  db: DbClient,
  id: string,
  action: BattleAction,
): Promise<BattleView> {
  const stored = await findBattle(db, id);
  if (stored === undefined) {
    throw new BattleNotFoundError(id);
  }
  const state = applyAction(stored.state, action, await loadTypeChart(db));
  if (!(await updateBattle(db, id, state, stored.version))) {
    throw new BattleConflictError(id);
  }
  return toBattleView(id, state);
}
