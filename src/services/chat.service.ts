import pool from '../models/db.model';

export interface SaveMessageOpts {
  environmentId: number;
  placeId?:      number;
  userId:        number;
  content:       string;
  type:          'chat'|'action';
  actionType?:   'me'|'do'|'rr'|null;
}

export class ChatService {
  static async saveMessage(opts: SaveMessageOpts) {
    const { environmentId, placeId, userId, content, type, actionType } = opts;
    console.log('[ChatService.saveMessage]', {
      environmentId, placeId, userId, content, type, actionType
    });
    await pool.query(
      `INSERT INTO messages
         (environment_id, place_id, user_id, content, \`type\`, action_type)
       VALUES (?,?,?,?,?,?)`,
      [environmentId, placeId ?? null, userId, content, type, actionType ?? null]
    );
  }

  static async getRecentMessages(environmentId: number, placeId?: number) {
    const [rows] = await pool.query(
      `SELECT m.id, m.content, m.\`type\`, m.action_type, m.created_at, u.username
         FROM messages m
         JOIN users u ON u.id = m.user_id
        WHERE m.environment_id = ?
          AND (m.place_id = ? OR ? IS NULL)
        ORDER BY m.created_at
        LIMIT 100`,
      [environmentId, placeId ?? null, placeId ?? null]
    );
    return rows as Array<{
      id: number;
      username: string;
      content: string;
      type: 'chat'|'action';
      action_type?: 'me'|'do'|'rr'|null;
      created_at: string;
    }>;
  }
}
