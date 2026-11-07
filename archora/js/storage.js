// js/storage.js — localStorage persistence + JSON export/import (configuration data only, never the Three.js scene).
import { normalizeConfig } from './state.js';

const STORAGE_KEY = 'archora.designs.v1';
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export function isStorageAvailable() {
  try { const k = '__archora_test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (error) { return false; }
}
function friendlyError(error) {
  if (error && (error.name === 'QuotaExceededError' || error.code === 22)) return 'Browser storage is full. Delete some saved designs and try again.';
  return 'Browser storage is unavailable (private mode or blocked). Your design was not saved.';
}
function sanitizeRecord(record) {
  if (!record || typeof record !== 'object') throw new Error('invalid record');
  if (typeof record.id !== 'string' || !/^[\w-]{1,64}$/.test(record.id)) throw new Error('invalid id');
  const now = new Date().toISOString();
  const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim().slice(0, 60) : 'Untitled Design';
  return {
    id: record.id, name,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
    config: normalizeConfig({ ...record.config, id: record.id, name }),
    thumbnail: null
  };
}
function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out = [];
    parsed.forEach((r) => { try { out.push(sanitizeRecord(r)); } catch (error) { /* skip invalid record */ } });
    return out;
  } catch (error) { console.error('[storage] read failed:', error); return []; }
}
function writeAll(list) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); return { ok: true }; }
  catch (error) { console.error('[storage] write failed:', error); return { ok: false, error: friendlyError(error) }; }
}
const generateId = () => `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const listDesigns = () => readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
export const getDesign = (id) => readAll().find((d) => d.id === id) || null;

/** Creates a new design, or overwrites the one with `id`. Returns { ok, design } or { ok: false, error }. */
export function saveDesign({ id = null, name, config }) {
  const list = readAll(); const now = new Date().toISOString();
  const cleanName = String(name || '').trim().slice(0, 60) || 'Untitled Design';
  const index = id ? list.findIndex((d) => d.id === id) : -1;
  const recordId = index >= 0 ? id : generateId();
  const record = {
    id: recordId, name: cleanName, createdAt: index >= 0 ? list[index].createdAt : now, updatedAt: now,
    config: normalizeConfig({ ...config, id: recordId, name: cleanName, updatedAt: now }), thumbnail: null
  };
  const next = [...list];
  if (index >= 0) next[index] = record; else next.unshift(record);
  const result = writeAll(next);
  return result.ok ? { ok: true, design: record } : result;
}
export function renameDesign(id, name) {
  const list = readAll(); const index = list.findIndex((d) => d.id === id);
  if (index < 0) return { ok: false, error: 'Design not found.' };
  const cleanName = String(name || '').trim().slice(0, 60) || list[index].name;
  list[index] = { ...list[index], name: cleanName, updatedAt: new Date().toISOString(), config: { ...list[index].config, name: cleanName } };
  const result = writeAll(list);
  return result.ok ? { ok: true, design: list[index] } : result;
}
export const deleteDesign = (id) => writeAll(readAll().filter((d) => d.id !== id));
export function duplicateDesign(id) {
  const source = readAll().find((d) => d.id === id);
  if (!source) return { ok: false, error: 'Design not found.' };
  return saveDesign({ name: `${source.name} (copy)`.slice(0, 60), config: source.config });
}

export function downloadDesignJson(config, name) {
  const payload = { app: 'ARCHORA', version: 2, exportedAt: new Date().toISOString(), design: config };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const slug = String(name || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';
  const link = document.createElement('a'); link.href = url; link.download = `archora-${slug}.json`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseImportedJson(text) {
  try {
    if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'The file is empty or too large (max 2 MB).' };
    const data = JSON.parse(text);
    const candidate = data && data.app === 'ARCHORA' && data.design ? data.design : data;
    return { ok: true, config: { ...normalizeConfig(candidate), id: null } };
  } catch (error) { return { ok: false, error: error instanceof SyntaxError ? 'This file is not valid JSON.' : error.message }; }
}