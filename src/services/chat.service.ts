import pool from '../models/db.model';

export interface SaveMessageOpts {
  environmentId: number;
  placeId?:      number;
  userId:        number;
  content:       string;
  type:          'chat'|'action';
}

export class ChatService {
  static async saveMessage(opts: SaveMessageOpts) {
    const { environmentId, placeId, userId, content, type } = opts;
    await pool.query(
      `INSERT INTO messages
         (environment_id, place_id, user_id, content, \`type\`)
       VALUES (?,?,?,?,?)`,
      [environmentId, placeId ?? null, userId, content, type]
    );
  }

  static async getRecentMessages(environmentId: number, placeId?: number) {
    const [rows] = await pool.query(
      `SELECT m.id, m.content, m.\`type\`, m.created_at, u.username
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
      created_at: string;
    }>;
  }
}
