import { healthResponseSchema } from '@pawlog/shared';
export async function getHealth(signal?: AbortSignal) {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('The API could not be reached.');
  return healthResponseSchema.parse(await response.json());
}
