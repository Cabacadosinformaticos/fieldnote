import type { Href } from 'expo-router';

// Typed routes only know the screens generated when the dev server last ran.
// New screens in this block are reached through this helper until that cache
// catches up.
export function moreHref(path: string): Href {
  return path as unknown as Href;
}
