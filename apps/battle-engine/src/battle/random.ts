// Seeded random generator (mulberry32). Its whole state is one 32-bit
// integer stored with the battle, so a turn can be replayed and the tests
// can script every draw.

export interface Random {
  /** A number in [0, 1). */
  next(): number;
  /** An integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** The state to store, from which `createRandom` resumes the sequence. */
  state(): number;
}

export function withNext(next: () => number, state: () => number): Random {
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    state,
  };
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return withNext(
    () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
    () => state,
  );
}
