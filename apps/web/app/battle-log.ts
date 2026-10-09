// French texts of the battle log, built from the engine's events.
import type { BattleEvent, BattleSide, Named } from "@pokebattle/shared";

/** PokeAPI lacks some translations: fall back to English, then the identifier. */
export function displayName(named: Named): string {
  return named.nameFr ?? named.nameEn ?? named.identifier;
}

function pokemonName(side: BattleSide, pokemon: Named): string {
  const name = displayName(pokemon);
  return side === "opponent" ? `${name} adverse` : name;
}

function effectivenessText(effectiveness: number): string {
  if (effectiveness > 1) {
    return "C'est super efficace ! ";
  }
  if (effectiveness < 1) {
    return "Ce n'est pas très efficace… ";
  }
  return "";
}

export function describeEvent(event: BattleEvent): string {
  switch (event.type) {
    case "turn-start":
      return `Tour ${event.turn}`;
    case "switch":
      return event.side === "player"
        ? `Vous envoyez ${displayName(event.pokemon)} !`
        : `L'adversaire envoie ${displayName(event.pokemon)} !`;
    case "move":
      return `${pokemonName(event.side, event.pokemon)} utilise ${displayName(event.move)} !`;
    case "miss":
      return `L'attaque de ${pokemonName(event.side, event.pokemon)} échoue !`;
    case "immune":
      return `Ça n'affecte pas ${pokemonName(event.side, event.pokemon)}…`;
    case "damage":
      return `${event.critical ? "Coup critique ! " : ""}${effectivenessText(event.effectiveness)}${pokemonName(event.side, event.pokemon)} : ${event.hpPercent} % PV.`;
    case "recoil":
      return `${pokemonName(event.side, event.pokemon)} subit le contrecoup : ${event.hpPercent} % PV.`;
    case "faint":
      return `${pokemonName(event.side, event.pokemon)} est K.O. !`;
    case "end":
      return event.winner === "player"
        ? "Vous avez gagné !"
        : event.winner === "opponent"
          ? "Vous avez perdu…"
          : "Match nul !";
  }
}
