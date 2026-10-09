/** A Pokéball drawn inline, for Pokémon that are hidden or have no sprite. */
export function Pokeball({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={label === undefined ? "presentation" : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      <circle cx="16" cy="16" r="14" fill="#f8fafc" />
      <path d="M2 16a14 14 0 0 1 28 0Z" fill="#ef4444" />
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="#1f2937"
        strokeWidth="2"
      />
      <path d="M2 16h28" stroke="#1f2937" strokeWidth="2" />
      <circle
        cx="16"
        cy="16"
        r="4.5"
        fill="#f8fafc"
        stroke="#1f2937"
        strokeWidth="2"
      />
    </svg>
  );
}
