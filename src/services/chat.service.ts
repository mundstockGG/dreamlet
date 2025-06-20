import pool from '../models/db.model';
import * as environmentService from './environment.service';
import * as placeService from './place.service';

export interface SaveMessageOpts {
  environmentId: number;
  placeId?:      number;
  content:       string;
  type:          'chat' | 'action';
  actionType?:   'me' | 'do' | 'rr' | null;
}

export class ChatService {
  static async saveMessage(
    opts: SaveMessageOpts & { actorId: number }
  ) {
    const {
      environmentId,
      placeId,
      actorId,
      content,
      type,
      actionType
    } = opts;

    const role = await environmentService.getMemberRole(actorId, environmentId);
    if (!role) {
      throw new Error('Unauthorized: you are not a member of this environment');
    }

    const [memberRows] = await pool.execute<any[]>(
      `SELECT is_muted
         FROM environment_members
        WHERE user_id = ? AND environment_id = ?`,
      [actorId, environmentId]
    );
    if (memberRows[0]?.is_muted) {
      throw new Error('You have been muted in this environment');
    }

    if (placeId != null) {
      const place = await placeService.getPlaceById(placeId);
      if (!place) {
        throw new Error('Place not found');
      }
      if (place.isLocked && role === 'member') {
        throw new Error('This place is locked. Only moderators/owners may post.');
      }
    }

    console.log('[ChatService.saveMessage]', {
      environmentId,
      placeId,
      actorId,
      content,
      type,
      actionType
    });

    await pool.query(
      `INSERT INTO messages
         (environment_id, place_id, user_id, content, \`type\`, action_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        environmentId,
        placeId ?? null,
        actorId,
        content,
        type,
        actionType ?? null
      ]
    );
  }

  static async getRecentMessages(
    environmentId: number,
    placeId?: number
  ) {
    const [rows] = await pool.query(
      `SELECT m.id,
              m.content,
              m.\`type\`,
              m.action_type,
              m.created_at,
              u.username
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
      type: 'chat' | 'action';
      action_type?: 'me' | 'do' | 'rr' | null;
      created_at: string;
    }>;
  }
}
