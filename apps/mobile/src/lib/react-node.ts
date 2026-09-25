import type { ReactNode } from "react";

export function isRenderable(node: ReactNode): boolean {
  return Boolean(node);
}
