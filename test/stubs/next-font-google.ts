/**
 * `next/font/google` only works inside the Next build (it downloads and inlines
 * font CSS at compile time). Vitest imports template modules purely for their
 * exports (hero-variant.test.ts → lib/ai/generate → template registries), so
 * every loader used in the repo is stubbed to return the {className, variable,
 * style} shape the wrappers read. Named exports must be static (vite resolves
 * ESM bindings at transform time — a Proxy default can't provide them), so a
 * NEW font family needs one line here; the test failure names it plainly.
 */
type FontStub = (options?: unknown) => {
  className: string;
  variable: string;
  style: { fontFamily: string };
};

function font(name: string): FontStub {
  return () => ({
    className: `font-stub-${name}`,
    variable: `--font-stub-${name}`,
    style: { fontFamily: name },
  });
}

export const Comfortaa = font("Comfortaa");
export const Cormorant_Garamond = font("Cormorant_Garamond");
export const Inter = font("Inter");
export const JetBrains_Mono = font("JetBrains_Mono");
export const Jost = font("Jost");
export const Literata = font("Literata");
export const Lora = font("Lora");
export const Manrope = font("Manrope");
export const Montserrat = font("Montserrat");
export const Nunito = font("Nunito");
export const Nunito_Sans = font("Nunito_Sans");
export const Onest = font("Onest");
export const Playfair_Display = font("Playfair_Display");
export const Poppins = font("Poppins");
export const Quicksand = font("Quicksand");
export const Rubik = font("Rubik");
export const Source_Sans_3 = font("Source_Sans_3");
export const Unbounded = font("Unbounded");
