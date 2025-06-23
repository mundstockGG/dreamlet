import pool from '../models/db.model';
import * as environmentService from './environment.service';
import * as placeService       from './place.service';

export interface SaveMessageOpts {
  environmentId: number;
  placeId?:      number;
  content:       string;
  type:          'chat' | 'action' | 'roll';
  actionType?:   'me' | 'do' | 'rr' | null;
  diceType?:     string;
  diceCount?:    number;
  results?:      number[];
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
      actionType,
      diceType,
      diceCount,
      results
    } = opts;

    const roleRows = await environmentService.getMemberRole(actorId, environmentId);
    if (!roleRows) throw new Error('Unauthorized');
    const [mRows] = await pool.execute<any[]>(
      `SELECT is_muted
         FROM environment_members
        WHERE user_id = ? AND environment_id = ?`,
      [actorId, environmentId]
    );
    if (mRows[0]?.is_muted) throw new Error('You are muted');

    // place lock check
    if (placeId != null) {
      const place = await placeService.getPlaceById(placeId);
      if (!place) throw new Error('Place not found');
      if (place.isLocked && roleRows === 'member')
        throw new Error('This place is locked');
    }

    await pool.query(
      `INSERT INTO messages
         (environment_id, place_id, user_id, content, \`type\`, action_type, dice_type, dice_count, results)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        environmentId,
        placeId ?? null,
        actorId,
        content,
        type,
        actionType ?? null,
        diceType ?? null,
        diceCount ?? null,
        results ? JSON.stringify(results) : null
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
              m.dice_type,
              m.dice_count,
              m.results,
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
      id:           number;
      username:     string;
      content:      string;
      type:         'chat' | 'action' | 'roll';
      action_type?: 'me' | 'do' | 'rr' | null;
      dice_type?:   string;
      dice_count?:  number;
      results?:     string;
      created_at:   string;
    }>;
  }
}
