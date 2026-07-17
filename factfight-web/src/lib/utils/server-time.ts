import "server-only";

export function getRequestTimestamp(): number {
  return Date.now();
}
