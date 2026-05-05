// Phase A-3 — typed wrappers around /api/collections.

import { apiJson } from '../../auth/apiFetch';

export type Collection = {
  id:           string;
  brandId:      string;
  advertiserId: string;
  name:         string;
  mediaCount:   number;
  mediaIds:     string[];
  createdAt:    string;
  updatedAt:    string;
};

export async function listCollections(brandId: string): Promise<Collection[]> {
  const res = await apiJson<{ collections: Collection[] }>(`/api/collections?brandId=${encodeURIComponent(brandId)}`);
  return res.collections || [];
}

export async function createCollection(brandId: string, name: string, mediaIds: string[] = []): Promise<Collection> {
  const res = await apiJson<{ collection: Collection }>(`/api/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandId, name, mediaIds })
  });
  return res.collection;
}

export async function renameCollection(id: string, name: string): Promise<Collection> {
  const res = await apiJson<{ collection: Collection }>(`/api/collections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  return res.collection;
}

export async function deleteCollection(id: string): Promise<void> {
  await apiJson(`/api/collections/${id}`, { method: 'DELETE' });
}

export async function addMediaToCollection(id: string, mediaIds: string[]): Promise<Collection> {
  const res = await apiJson<{ collection: Collection; added: number }>(`/api/collections/${id}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mediaIds })
  });
  return res.collection;
}

export async function removeMediaFromCollection(id: string, mediaId: string): Promise<Collection> {
  const res = await apiJson<{ collection: Collection }>(`/api/collections/${id}/media/${mediaId}`, {
    method: 'DELETE'
  });
  return res.collection;
}
