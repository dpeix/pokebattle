import type { TeamMemberInput } from "@pokebattle/shared";
import { createCookieSessionStorage, type Session } from "react-router";
import { requireEnv } from "./env.server";

interface SessionData {
  /** The last team the player fought with, to edit it or play again. */
  team: TeamMemberInput[];
  /** The battle in progress, stored by the battle engine. */
  battleId: string;
}

export type PokebattleSession = Session<SessionData>;

let storage: ReturnType<typeof createCookieSessionStorage<SessionData>>;

function sessionStorage() {
  storage ??= createCookieSessionStorage<SessionData>({
    cookie: {
      name: "__pokebattle",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      secrets: [requireEnv("SESSION_SECRET")],
      maxAge: 60 * 60 * 24 * 30,
    },
  });
  return storage;
}

export function getSession(request: Request): Promise<PokebattleSession> {
  return sessionStorage().getSession(request.headers.get("Cookie"));
}

export async function commitSession(
  session: PokebattleSession,
): Promise<HeadersInit> {
  return { "Set-Cookie": await sessionStorage().commitSession(session) };
}
