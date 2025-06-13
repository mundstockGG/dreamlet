export async function getPlaceMessages(placeId: number) {
  const [rows] = await pool.execute<any[]>(
    `SELECT
       m.id,
       m.user_id    AS userId,
       u.username,
       m.content,
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
  userId: number,
  content: string,
  type: 'chat' | 'action' | 'roll' | 'desc' = 'chat'
) {
  await pool.execute(
    `INSERT INTO messages
       (environment_id, place_id, user_id, content, type)
     VALUES (?,?,?,?,?)`,
    [envId, placeId, userId, content, type]
  );
}
import pool from '../models/db.model';

export interface PlaceRow {
  id: number;
  envId: number;
  name: string;
  emoji: string;
  parentId: number | null;
  isLocked: boolean;
}

export async function createPlace(
  environmentId: number,
  name: string,
  emoji: string,
  parentId: number | null
) {
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
  name: string,
  emoji: string,
  parentId: number | null
) {
  await pool.execute(
    `UPDATE places
       SET name = ?, emoji = ?, parent_id = ?
     WHERE id = ?`,
    [name, emoji, parentId, placeId]
  );
}

export async function updatePlaceLock(placeId: number, isLocked: boolean) {
  await pool.execute(
    `UPDATE places
       SET is_locked = ?
     WHERE id = ?`,
    [isLocked ? 1 : 0, placeId]
  );
}

export async function deletePlace(placeId: number) {
  await pool.execute(
    `DELETE FROM places WHERE id = ?`,
    [placeId]
  );
}
