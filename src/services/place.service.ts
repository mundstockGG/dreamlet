import pool from '../models/db.model';
import * as environmentService from './environment.service';

export interface PlaceRow {
  id: number;
  envId: number;
  name: string;
  emoji: string;
  parentId: number | null;
  isLocked: boolean;
}

export interface PlaceMessage {
  id: number;
  userId: number;
  username: string;
  content: string;
  type: 'chat' | 'action' | 'roll' | 'desc';
  actionType?: 'me' | 'do' | 'rr' | null;
  createdAt: string;
}

export async function getPlaceMessages(placeId: number): Promise<PlaceMessage[]> {
  const [rows] = await pool.execute<any[]>(
    `SELECT
       m.id,
       m.user_id    AS userId,
       u.username,
       m.content,
       m.type,
       m.action_type AS actionType,
       m.created_at AS createdAt
     FROM messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.place_id = ?
     ORDER BY m.created_at ASC`,
    [placeId]
  );
  return rows;
}

export async function createPlaceMessage(
  envId: number,
  placeId: number,
  actorId: number,
  content: string,
  type: 'chat' | 'action' | 'roll' | 'desc' = 'chat'
) {
  const role = await environmentService.getMemberRole(actorId, envId);
  if (!role) throw new Error('Unauthorized: not a member of this environment');

  const [memberRows] = await pool.execute<any[]>(
    `SELECT is_muted FROM environment_members
       WHERE user_id = ? AND environment_id = ?`,
    [actorId, envId]
  );
  if (memberRows[0]?.is_muted) {
    throw new Error('You have been muted in this environment');
  }

  const place = await getPlaceById(placeId);
  if (!place) throw new Error('Place not found');
  if (place.isLocked && role === 'member') {
    throw new Error('This place is locked. Only moderators or the owner may post.');
  }

  await pool.execute(
    `INSERT INTO messages
       (environment_id, place_id, user_id, content, type)
     VALUES (?, ?, ?, ?, ?)`,
    [envId, placeId, actorId, content, type]
  );
}

export async function createPlace(
  environmentId: number,
  actorId: number,
  name: string,
  emoji: string,
  parentId: number | null
) {
  const role = await environmentService.getMemberRole(actorId, environmentId);
  if (role !== 'owner' && role !== 'moderator') {
    throw new Error('Unauthorized: must be owner or moderator to create a place');
  }
  if (name.toLowerCase() === 'lobby') {
    throw new Error('Cannot create a place named "Lobby". It is reserved.');
  }
  await pool.execute(
    `INSERT INTO places
       (environment_id, name, emoji, parent_id)
     VALUES (?, ?, ?, ?)`,
    [environmentId, name, emoji, parentId]
  );
}

export async function getPlaces(environmentId: number) {
  const [rows] = await pool.execute<any[]>(
    `SELECT
       p.id,
       p.name,
       p.emoji,
       p.parent_id   AS parentId,
       parent.name   AS parentName,
       p.is_locked   AS isLocked
     FROM places p
     LEFT JOIN places parent ON parent.id = p.parent_id
     WHERE p.environment_id = ?
     ORDER BY p.parent_id, p.id`,
    [environmentId]
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    parentId: r.parentId,
    parentName: r.parentName,
    isLocked: Boolean(r.isLocked)
  }));
}

export async function getPlaceById(placeId: number): Promise<PlaceRow | null> {
  const [rows] = await pool.execute<any[]>(
    `SELECT
       id,
       environment_id AS envId,
       name,
       emoji,
       parent_id       AS parentId,
       is_locked       AS isLocked
     FROM places
     WHERE id = ?`,
    [placeId]
  );
  return (rows as PlaceRow[])[0] || null;
}

export async function updatePlace(
  placeId: number,
  actorId: number,
  name: string,
  emoji: string,
  parentId: number | null
) {
  const place = await getPlaceById(placeId);
  if (!place) throw new Error('Place not found');

  const role = await environmentService.getMemberRole(actorId, place.envId);
  if (role !== 'owner' && role !== 'moderator') {
    throw new Error('Unauthorized: cannot edit place');
  }

  await pool.execute(
    `UPDATE places
       SET name = ?, emoji = ?, parent_id = ?
     WHERE id = ?`,
    [name, emoji, parentId, placeId]
  );
}

export async function updatePlaceLock(
  placeId: number,
  actorId: number,
  isLocked: boolean
) {
  const place = await getPlaceById(placeId);
  if (!place) throw new Error('Place not found');

  const role = await environmentService.getMemberRole(actorId, place.envId);
  if (role !== 'owner' && role !== 'moderator') {
    throw new Error('Unauthorized: cannot change lock state');
  }

  await pool.execute(
    `UPDATE places
       SET is_locked = ?
     WHERE id = ?`,
    [isLocked ? 1 : 0, placeId]
  );
}

export async function deletePlace(
  placeId: number,
  actorId: number
) {
  const place = await getPlaceById(placeId);
  if (!place) throw new Error('Place not found');

  const role = await environmentService.getMemberRole(actorId, place.envId);
  if (role !== 'owner' && role !== 'moderator') {
    throw new Error('Unauthorized: cannot delete place');
  }
  if (place.name.toLowerCase() === 'lobby') {
    throw new Error('Cannot delete the Lobby place');
  }

  await pool.execute(
    `DELETE FROM places WHERE id = ?`,
    [placeId]
  );
}
