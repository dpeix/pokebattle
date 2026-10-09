import { Link } from "react-router";
import { getSession } from "~/session.server";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Pokebattle" },
    { name: "description", content: "Simulateur de combat" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  return { hasBattle: session.has("battleId") };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="text-3xl font-bold">Pokebattle</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Simulateur de combat
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          to="/team"
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Composer mon équipe
        </Link>
        {loaderData.hasBattle && (
          <Link
            to="/battle"
            className="rounded border border-blue-600 px-4 py-2 font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-900"
          >
            Reprendre le combat
          </Link>
        )}
      </div>
    </main>
  );
}
