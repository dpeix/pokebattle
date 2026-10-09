import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Pokebattle" },
    { name: "description", content: "Simulateur de combat" },
  ];
}

export default function Home() {
  return (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="text-3xl font-bold">Pokebattle</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Simulateur de combat
      </p>
    </main>
  );
}
