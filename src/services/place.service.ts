import pool from '../models/db.model';

export interface PlaceRow {
  id: number;
  envId: number;
  name: string;
  emoji: string;
  parentId: number | null;
  isLocked: boolean;
}

/**
 * Create a new place in an environment.
 */
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

/**
 * Fetch all places (with parentName) for the manage page.
 */
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

/**
 * Fetch a single place by its ID.
 */
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

/**
 * Update name/emoji/parent of a place.
 */
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

/**
 * Toggle the lock state of a place.
 */
export async function updatePlaceLock(placeId: number, isLocked: boolean) {
  await pool.execute(
    `UPDATE places
       SET is_locked = ?
     WHERE id = ?`,
    [isLocked ? 1 : 0, placeId]
  );
}
