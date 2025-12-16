import { parse, formatHsl } from "culori";

export function isValidColor(input: string) {
  return !!parse(input.trim());
}

export function formatColor(input: string) {
  const color = parse(input.trim());
  return color ? formatHsl(color) : "";
}

/**
 * Generates a color that is visually pleasing and high-contrast.
 * Safe for production UI where consistency matters.
 */
export function getRandomHslColor(saturation = 70, lightness = 50) {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
