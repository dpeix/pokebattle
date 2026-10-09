import type { Named } from "@pokebattle/shared";
import { displayName } from "~/battle-log";

export function TypeList({ types }: { types: Named[] }) {
  return (
    <span className="inline-flex gap-1">
      {types.map((type) => (
        <span
          key={type.identifier}
          className="rounded bg-gray-200 px-1.5 py-0.5 text-xs dark:bg-gray-800"
        >
          {displayName(type)}
        </span>
      ))}
    </span>
  );
}

export function HpBar({ percent }: { percent: number }) {
  const color =
    percent > 50
      ? "bg-green-500"
      : percent > 20
        ? "bg-yellow-500"
        : "bg-red-500";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded bg-gray-200 dark:bg-gray-800"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full ${color} transition-[width,background-color] duration-700 ease-out`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
