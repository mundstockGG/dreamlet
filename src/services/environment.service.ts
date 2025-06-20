import pool from '../models/db.model';
import crypto from 'crypto';

export interface Environment {
  id: number;
  name: string;
  isNSFW: boolean;
  difficulty: 'chill' | 'survival';
  inviteCode: string;
  isLocked: boolean;
  tags: string[];
  ownerId: number;
  createdAt: string;
  isOwner?: boolean;
}

export interface Member {
  id: number;
  username: string;
  role: 'owner' | 'moderator' | 'member';
  isMuted: boolean;
}

export interface Message {
  id: number;
  userId: number;
  username: string;
  content: string;
  type: 'chat' | 'action';
  actionType?: 'me' | 'do' | 'rr' | null;
  createdAt: string;
}

export async function findByUser(userId: number): Promise<Environment[]> {
  const [rows] = await pool.execute<any[]>(
    `SELECT e.id,
            e.name,
            e.is_nsfw      AS isNSFW,
            e.difficulty,
            e.invite_code  AS inviteCode,
            e.is_locked    AS isLocked,
            e.tags,
            e.owner_id     AS ownerId,
            e.created_at   AS createdAt
       FROM environments e
       JOIN environment_members m
         ON m.environment_id = e.id
        AND m.user_id = ?`,
    [userId]
  );
  return rows.map(r => ({ ...r, tags: JSON.parse(r.tags) }));
}

export async function getEnvironmentById(envId: number): Promise<Environment|null> {
  const [rows] = await pool.execute<any[]>(
    `SELECT id,
            name,
            is_nsfw      AS isNSFW,
            difficulty,
            invite_code  AS inviteCode,
            is_locked    AS isLocked,
            tags,
            owner_id     AS ownerId,
            created_at   AS createdAt
       FROM environments
      WHERE id = ?`,
    [envId]
  );
  if (!rows[0]) return null;
  return { ...rows[0], tags: JSON.parse(rows[0].tags) };
}

export async function getEnvironmentByInviteCode(code: string): Promise<Environment|null> {
  const [rows] = await pool.execute<any[]>(
    `SELECT id,
            name,
            is_nsfw      AS isNSFW,
            difficulty,
            invite_code  AS inviteCode,
            is_locked    AS isLocked,
            tags,
            owner_id     AS ownerId,
            created_at   AS createdAt
       FROM environments
      WHERE invite_code = ?`,
    [code]
  );
  if (!rows[0]) return null;
  return { ...rows[0], tags: JSON.parse(rows[0].tags) };
}

export async function getMembers(envId: number): Promise<Member[]> {
  const [rows] = await pool.execute<any[]>(
    `SELECT u.id,
            u.username,
            m.role,
            m.is_muted AS isMuted
       FROM environment_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.environment_id = ?`,
    [envId]
  );
  return rows;
}

export async function getMemberRole(userId: number, envId: number): Promise<'owner'|'moderator'|'member'|null> {
  const env = await getEnvironmentById(envId);
  if (env?.ownerId === userId) return 'owner';
  const [rows] = await pool.execute<any[]>(
    `SELECT role FROM environment_members
      WHERE user_id = ? AND environment_id = ?`,
    [userId, envId]
  );
  return (rows[0]?.role as 'moderator'|'member') || null;
}

export async function createEnvironment(opts: {
  ownerId: number;
  name: string;
  isNSFW: boolean;
  difficulty: 'chill' | 'survival';
  tags: string[];
}): Promise<number> {
  const code = crypto.randomBytes(4).toString('hex');
  const tagsJson = JSON.stringify(opts.tags);

  const [result] = await pool.execute<any>(
    `INSERT INTO environments
       (name,is_nsfw,difficulty,invite_code,owner_id,tags)
     VALUES (?,?,?,?,?,?)`,
    [opts.name, opts.isNSFW ? 1 : 0, opts.difficulty, code, opts.ownerId, tagsJson]
  );
  const envId = result.insertId;

  await pool.execute(
    `INSERT INTO environment_members
       (user_id,environment_id,role)
     VALUES (?,?, 'owner')`,
    [opts.ownerId, envId]
  );
  await pool.execute(
    `INSERT INTO places (id, environment_id, name, emoji, parent_id)
     VALUES (?, ?, 'Lobby', '💬', NULL)`,
    [envId, envId]
  );

  return envId;
}

export async function joinEnvironment(
  actorId: number,
  code: string
) {
  const env = await getEnvironmentByInviteCode(code);
  if (!env) throw new Error('Invalid invite code');
  if (env.isLocked) throw new Error('Environment is locked');

  const [ban] = await pool.execute<any[]>(
    `SELECT 1 FROM environment_bans
      WHERE environment_id = ? AND user_id = ?`,
    [env.id, actorId]
  );
  if (ban.length) throw new Error('You are banned');

  await pool.execute(
    `INSERT INTO environment_members
       (user_id,environment_id,role)
     VALUES (?,?, 'member')`,
    [actorId, env.id]
  );
}

export async function leaveEnvironment(
  actorId: number,
  envId: number
) {
  const role = await getMemberRole(actorId, envId);
  if (!role) throw new Error('Not a member');
  if (role === 'owner') throw new Error('Owner must delete the environment');

  await pool.execute(
    `DELETE FROM environment_members
      WHERE user_id = ? AND environment_id = ?`,
    [actorId, envId]
  );
}

export async function promoteMember(
  envId: number,
  actorId: number,
  targetUserId: number
) {
  const env = await getEnvironmentById(envId);
  if (!env || env.ownerId !== actorId) throw new Error('Unauthorized');
  if (targetUserId === env.ownerId) throw new Error('Cannot promote owner');

  await pool.execute(
    `UPDATE environment_members
       SET role = 'moderator'
     WHERE environment_id = ? AND user_id = ?`,
    [envId, targetUserId]
  );
}

export async function kickMember(
  envId: number,
  actorId: number,
  targetUserId: number
) {
  const env = await getEnvironmentById(envId);
  if (!env || env.ownerId !== actorId) throw new Error('Unauthorized');
  if (targetUserId === env.ownerId) throw new Error('Cannot remove owner');

  await pool.execute(
    `DELETE FROM environment_members
      WHERE environment_id = ? AND user_id = ?`,
    [envId, targetUserId]
  );
}

export async function banMember(
  envId: number,
  actorId: number,
  targetUserId: number
) {
  const env = await getEnvironmentById(envId);
  if (!env || env.ownerId !== actorId) throw new Error('Unauthorized');
  if (targetUserId === env.ownerId) throw new Error('Cannot ban owner');

  // re-use secured kick
  await kickMember(envId, actorId, targetUserId);

  await pool.execute(
    `INSERT IGNORE INTO environment_bans
       (environment_id,user_id)
     VALUES (?,?)`,
    [envId, targetUserId]
  );
}

export async function toggleMuteMember(
  envId: number,
  actorId: number,
  targetUserId: number
) {
  const env = await getEnvironmentById(envId);
  if (!env || env.ownerId !== actorId) throw new Error('Unauthorized');
  if (targetUserId === env.ownerId) throw new Error('Cannot mute owner');

  await pool.execute(
    `UPDATE environment_members
       SET is_muted = NOT is_muted
     WHERE environment_id = ? AND user_id = ?`,
    [envId, targetUserId]
  );
}

export async function updateLockState(
  envId: number,
  actorId: number,
  isLocked: boolean
) {
  const env = await getEnvironmentById(envId);
  if (!env || env.ownerId !== actorId) throw new Error('Unauthorized');

  await pool.execute(
    `UPDATE environments
       SET is_locked = ?
     WHERE id = ?`,
    [isLocked ? 1 : 0, envId]
  );
}

export async function getEnvironmentMessages(envId: number): Promise<Message[]> {
  const [rows] = await pool.execute<any[]>(
    `SELECT m.id,
            m.user_id    AS userId,
            u.username,
            m.content,
            m.type,
            m.action_type,
            m.created_at AS createdAt
       FROM messages m
       JOIN users u ON u.id = m.user_id
      WHERE m.environment_id = ? AND m.place_id = ?
      ORDER BY m.created_at ASC`,
    [envId, envId]
  );
  return rows;
}

export async function createEnvironmentMessage(
  envId: number,
  actorId: number,
  content: string,
  type: 'chat' | 'action' = 'chat'
) {
  const role = await getMemberRole(actorId, envId);
  if (!role) throw new Error('Unauthorized');

  const [member] = await pool.execute<any[]>(
    `SELECT is_muted FROM environment_members
      WHERE user_id = ? AND environment_id = ?`,
    [actorId, envId]
  );
  if (member[0]?.is_muted) throw new Error('You are muted');

  await pool.execute(
    `INSERT INTO messages
       (environment_id, place_id, user_id, content, type)
     VALUES (?, NULL, ?, ?, ?)`,
    [envId, actorId, content, type]
  );
}

export async function deleteEnvironment(
  envId: number,
  actorId: number
): Promise<void> {
  const env = await getEnvironmentById(envId);
  if (!env || env.ownerId !== actorId) throw new Error('Unauthorized');

  await pool.execute(`DELETE FROM environment_members WHERE environment_id = ?`, [envId]);
  await pool.execute(`DELETE FROM places WHERE environment_id = ?`, [envId]);
  await pool.execute(`DELETE FROM messages WHERE environment_id = ?`, [envId]);
  await pool.execute(`DELETE FROM environments WHERE id = ?`, [envId]);
}
