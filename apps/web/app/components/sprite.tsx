import { useEffect, useRef, useState } from "react";
import { Pokeball } from "~/components/pokeball";

// Downloaded by `make sprites`: the animated sprite, else the still one.
const EXTENSIONS = ["gif", "png"] as const;

/**
 * Sprite of a Pokémon, from the front (opponent) or the back (player). Falls
 * back to a Pokéball when the sprites are not downloaded.
 */
export function PokemonSprite({
  pokemonId,
  view,
  className,
}: {
  pokemonId: number;
  view: "front" | "back";
  className?: string;
}) {
  const sprite = `${view}/${pokemonId}`;
  // Failures are counted per sprite: another Pokémon starts with its GIF.
  const [failures, setFailures] = useState({ sprite, count: 0 });
  const attempt = failures.sprite === sprite ? failures.count : 0;
  const image = useRef<HTMLImageElement>(null);
  const extension = EXTENSIONS[attempt];

  function fail() {
    setFailures({ sprite, count: attempt + 1 });
  }

  // An image that failed before hydration fired its error event before
  // React listened to it.
  useEffect(() => {
    const element = image.current;
    if (element?.complete && element.naturalWidth === 0) {
      fail();
    }
  });

  if (extension === undefined) {
    return <Pokeball className={`${className ?? ""} opacity-30`} />;
  }
  return (
    <img
      ref={image}
      src={`/sprites/${sprite}.${extension}`}
      alt=""
      onError={fail}
      className={`[image-rendering:pixelated] object-contain ${className ?? ""}`}
    />
  );
}
