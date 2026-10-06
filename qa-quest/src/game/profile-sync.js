import { createCampusProfile, mergeCampusProfile } from './campus-profile.js';

export const CAMPUS_SYNC_SCHEMA = 'quequest.campus.v15';
export const LEGACY_CAMPUS_SYNC_SCHEMAS = Object.freeze(['quequest.campus.v14','quequest.campus.v13','quequest.campus.v12','quequest.campus.v11','quequest.campus.v10','quequest.campus.v9','quequest.campus.v8','quequest.campus.v7','quequest.campus.v6','quequest.campus.v5','quequest.campus.v4','quequest.campus.v3','quequest.campus.v2']);

export function createProgressEnvelope(profile, { deviceId = 'local', gameVersion = 16 } = {}) {
  return {
    schema: CAMPUS_SYNC_SCHEMA,
    gameVersion,
    deviceId: String(deviceId || 'local').slice(0, 80),
    profile: createCampusProfile(profile),
  };
}

export function mergeProgressEnvelope(localProfile, remoteEnvelope) {
  if (!remoteEnvelope || ![CAMPUS_SYNC_SCHEMA, ...LEGACY_CAMPUS_SYNC_SCHEMAS].includes(remoteEnvelope.schema) || !remoteEnvelope.profile) {
    throw new Error('invalid-progress-envelope');
  }
  return mergeCampusProfile(localProfile, remoteEnvelope.profile);
}

export async function syncCampusProgress({
  profile,
  endpoint = '/api/progress/quequest',
  accessToken,
  deviceId = 'browser',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!accessToken) throw new Error('auth-required');
  if (typeof fetchImpl !== 'function') throw new Error('fetch-unavailable');
  const envelope = createProgressEnvelope(profile, {deviceId});
  const response = await fetchImpl(endpoint, {
    method:'PUT',
    headers:{
      'content-type':'application/json',
      authorization:`Bearer ${accessToken}`,
    },
    body:JSON.stringify(envelope),
  });
  if (!response?.ok) throw new Error(`sync-failed:${response?.status ?? 'network'}`);
  const remote = await response.json();
  return {
    profile: mergeProgressEnvelope(profile, remote),
    remote,
  };
}
