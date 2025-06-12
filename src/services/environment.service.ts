import pool from '../models/db.model';
import crypto from 'crypto';
// @ts-ignore
import * as placeService from '../services/place.service';

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

// Count environments by owner (for tier limits)
export async function countEnvironmentsByUser(ownerId: number): Promise<number> {
  const [rows] = await pool.execute<any[]>(
    `SELECT COUNT(*) AS cnt 
       FROM environments 
      WHERE owner_id = ?`,
    [ownerId]
  );
  return rows[0].cnt;
}

// Create environment + auto‐add lobby + membership
export async function createEnvironment(data: {
  ownerId: number;
  name: string;
  isNSFW: boolean;
  difficulty: 'chill' | 'survival';
  tags: string[];
}) {
  const inviteCode = crypto.randomBytes(4).toString('hex');
  const tagsJson   = JSON.stringify(data.tags);

  // Insert environment with difficulty
  const [result] = await pool.execute<any>(
    `INSERT INTO environments
       (name, is_nsfw, difficulty, owner_id, invite_code, tags)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.isNSFW ? 1 : 0,
      data.difficulty,
      data.ownerId,
      inviteCode,
      tagsJson
    ]
  );

  const envId = result.insertId;

  // Auto‐join owner as moderator/owner
  await pool.execute(
    `INSERT INTO environment_members (user_id, environment_id, role)
     VALUES (?, ?, 'owner')`,
    [data.ownerId, envId]
  );

  return envId;
}

// Toggle environment lock
export async function updateLockState(envId: number, isLocked: boolean) {
  await pool.execute(
    `UPDATE environments
       SET is_locked = ?
     WHERE id = ?`,
    [isLocked ? 1 : 0, envId]
  );
}

// Promote a member to moderator
export async function promoteMember(envId: number, userId: number) {
  await pool.execute(
    `UPDATE environment_members
       SET role = 'moderator'
     WHERE environment_id = ? AND user_id = ?`,
    [envId, userId]
  );
}

// Kick a member (remove)
export async function kickMember(envId: number, userId: number) {
  await pool.execute(
    `DELETE FROM environment_members
     WHERE environment_id = ? AND user_id = ?`,
    [envId, userId]
  );
}

// Ban a member (kick + record)
export async function banMember(envId: number, userId: number) {
  // remove membership
  await kickMember(envId, userId);
  // record ban
  await pool.execute(
    `INSERT IGNORE INTO environment_bans
       (environment_id, user_id)
     VALUES (?, ?)`,
    [envId, userId]
  );
}

// Toggle mute on a member
export async function toggleMuteMember(envId: number, userId: number) {
  await pool.execute(
    `UPDATE environment_members
       SET is_muted = NOT is_muted
     WHERE environment_id = ? AND user_id = ?`,
    [envId, userId]
  );
}

// Prevent banned users from rejoining
export async function isUserBanned(envId: number, userId: number) {
  const [rows] = await pool.execute<any[]>(
    `SELECT 1 FROM environment_bans WHERE environment_id = ? AND user_id = ?`,
    [envId, userId]
  );
  return rows.length > 0;
}

// In joinEnvironment, check for ban before inserting
export async function joinEnvironment(userId: number, inviteCode: string) {
  const [rows] = await pool.execute<any[]>(
    'SELECT id, is_locked FROM environments WHERE invite_code = ?',
    [inviteCode]
  );
  const env = rows[0];
  if (!env) throw new Error('Invalid invite code');
  if (env.is_locked) throw new Error('This environment is locked');
  if (await isUserBanned(env.id, userId)) {
    throw new Error('You are banned from this environment');
  }
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
       owner_id AS ownerId,
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

/** Returns 'owner' | 'moderator' | 'member' or null */
export async function getMemberRole(userId: number, envId: number): Promise<string|null> {
  // check if owner
  const [[envRow]] = await pool.execute<any[]>(`SELECT owner_id FROM environments WHERE id = ?`, [envId]);
  if (envRow?.owner_id === userId) return 'owner';

  // check membership
  const [memberRows] = await pool.execute<any[]>(
    `SELECT role FROM environment_members 
     WHERE environment_id = ? AND user_id = ?
  `, [envId, userId]);
  return memberRows[0]?.role || null;
}
