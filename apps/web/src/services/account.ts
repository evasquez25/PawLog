import { dataSchemas } from '@pawlog/shared';
import { apiRequest } from './client';
export function getAccount(signal?: AbortSignal) {
  return apiRequest('/me', dataSchemas.account, { signal });
}
