import pool from '../models/db.model';
import crypto from 'crypto';

interface NewEnv {
  ownerId: number;
  name: string;
  isNSFW: boolean;
  tags: string[];
}

export async function findByUser(userId: number) {
  const sql = `
    SELECT
      e.id,
      e.name,
      e.is_nsfw    AS isNSFW,
      e.invite_code AS inviteCode,
      e.tags,
      e.owner_id   = ? AS isOwner
    FROM environments e
    LEFT JOIN environment_members m
      ON e.id = m.environment_id
    WHERE e.owner_id = ?
       OR m.user_id  = ?
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `;
  const [rows] = await pool.execute(sql, [userId, userId, userId]);
  return rows as any[];
}

export async function createEnvironment(data: NewEnv) {
  const inviteCode = crypto.randomBytes(4).toString('hex');
  const tagsJson   = JSON.stringify(data.tags);
  const [result] = await pool.execute<any>(
    `INSERT INTO environments
       (name, is_nsfw, owner_id, invite_code, tags)
     VALUES (?, ?, ?, ?, ?)`,
    [data.name, data.isNSFW ? 1 : 0, data.ownerId, inviteCode, tagsJson]
  );
  const envId = result.insertId;
  await pool.execute(
    `INSERT INTO environment_members (user_id, environment_id, role)
       VALUES (?, ?, 'owner')`,
    [data.ownerId, envId]
  );
}

export async function joinEnvironment(userId: number, inviteCode: string) {
  const [rows] = await pool.execute<any[]>(
    'SELECT id, is_locked FROM environments WHERE invite_code = ?',
    [inviteCode]
  );
  const env = rows[0];
  if (!env) throw new Error('Invalid invite code');
  if (env.is_locked) throw new Error('This environment is locked');
  const [members] = await pool.execute<any[]>(
    'SELECT 1 FROM environment_members WHERE user_id = ? AND environment_id = ?',
    [userId, env.id]
  );
  if (members.length) throw new Error('Already a member');
  await pool.execute(
    'INSERT INTO environment_members (user_id, environment_id) VALUES (?, ?)',
    [userId, env.id]
  );
}

export async function leaveEnvironment(userId: number, envId: number) {
  const [rows] = await pool.execute<any[]>(
    'SELECT owner_id FROM environments WHERE id = ?',
    [envId]
  );
  if (rows[0].owner_id === userId) {
    throw new Error('Owners cannot leave their own environment');
  }
  const [result] = await pool.execute<any>(
    'DELETE FROM environment_members WHERE user_id = ? AND environment_id = ?',
    [userId, envId]
  );
  if (result.affectedRows === 0) {
    throw new Error('You are not a member of this environment');
  }
}

export async function getEnvironmentById(envId: number) {
  const [rows] = await pool.execute<any[]>(
    `SELECT 
       id, name,
       is_nsfw   AS isNSFW,
       is_locked AS isLocked,
       invite_code AS inviteCode,
       tags
     FROM environments
     WHERE id = ?`,
    [envId]
  );
  return rows[0] || null;
}

export async function isUserMember(userId: number, envId: number) {
  const [rows] = await pool.execute<any[]>(
    `SELECT 1 FROM (
       SELECT owner_id AS uid FROM environments WHERE id = ?
       UNION
       SELECT user_id AS uid    FROM environment_members WHERE environment_id = ?
     ) x WHERE uid = ?`,
    [envId, envId, userId]
  );
  return rows.length > 0;
}

export async function getMembers(envId: number) {
  const [owners] = await pool.execute<any[]>(
    `SELECT 
       u.id       AS id,
       u.username AS username,
       'owner'    AS role
     FROM users u
     JOIN environments e 
       ON u.id = e.owner_id
     WHERE e.id = ?`,
    [envId]
  );
  const [members] = await pool.execute<any[]>(
    `SELECT 
       u.id       AS id,
       u.username AS username,
       m.role     AS role
     FROM environment_members m
     JOIN users u 
       ON u.id = m.user_id
     WHERE m.environment_id = ?
       AND u.id != (SELECT owner_id FROM environments WHERE id = ?)
    `,
    [envId, envId]
  );
  return [...owners, ...members];
}

export async function getPlaces(envId: number) {
  const [rows] = await pool.execute<any[]>(
    `SELECT 
       p.id, p.name, p.emoji,
       p.is_locked AS isLocked,
       p.parent_id AS parentId,
       parent.name    AS parentName
     FROM places p
     LEFT JOIN places parent ON parent.id = p.parent_id
     WHERE p.environment_id = ?
     ORDER BY p.parent_id, p.id`,
    [envId]
  );
  return rows;
}

export async function createPlace(data: { environmentId: number; name: string; emoji: string; parentId: number | null; }) {
  await pool.execute(
    `INSERT INTO places 
      (environment_id, name, emoji, parent_id)
     VALUES (?, ?, ?, ?)`,
    [data.environmentId, data.name, data.emoji, data.parentId]
  );
}
