/**
 * Deep links into GoHighLevel — GHL is the system of record for relationship
 * state, so every surface that shows a synced record must offer a door into it.
 * Contact-detail links are the reliable target; opportunity deep links are not.
 * Server-side only (reads GHL_LOCATION_ID).
 */
export function ghlLocationId(): string | null {
  return process.env.GHL_LOCATION_ID || null;
}

export function ghlContactUrl(contactId: string | null | undefined): string | null {
  const loc = ghlLocationId();
  if (!loc || !contactId) return null;
  return `https://app.gohighlevel.com/v2/location/${loc}/contacts/detail/${contactId}`;
}
