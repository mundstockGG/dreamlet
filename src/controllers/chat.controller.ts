import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import * as envService   from '../services/environment.service';
import * as placeService from '../services/place.service';

export async function postChatMessage(
  req: Request,
  res: Response,
  next: Function
) {
  try {
    const user        = req.session.user;
    const environment = Number(req.params.envId);
    const place       = req.params.placeId ? Number(req.params.placeId) : undefined;

    const {
      message,
      diceType,
      diceCount,
      actionDescription
    } = req.body as {
      message?: string;
      diceType?: string;
      diceCount?: number;
      actionDescription?: string;
    };

    if (!user) {
      return res.status(400).json({ error: 'Missing user' });
    }

    if (diceType && diceCount && actionDescription) {
      const rolls = Array(diceCount)
        .fill(0)
        .map(() => Math.floor(Math.random() * 6) + 1);
      const total  = rolls.reduce((a,b) => a+b, 0);
      const content = `${actionDescription} — 🎲 rolled ${diceCount}×${diceType}: ${rolls.join(' + ')} = ${total}`;

      await ChatService.saveMessage({
        actorId:       user.id,
        environmentId: environment,
        placeId:       place,
        content,
        type:          'roll',
        diceType,
        diceCount,
        results:       rolls
      });

      return res.json({
        username:   user.username,
        content,
        type:       'roll',
        diceType,
        diceCount,
        rolls,
        total
      });
    }

    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    let type: 'chat'|'action' = 'chat';
    let actionType: 'me'|'do'|'rr'|null = null;
    let content = message;

    const slash = message.match(/^\/(me|do|rr)\s+(.+)$/i);
    if (slash) {
      type       = 'action';
      actionType = slash[1].toLowerCase() as 'me'|'do'|'rr';
      content    = slash[2].trim();
    }

    await ChatService.saveMessage({
      actorId:       user.id,
      environmentId: environment,
      placeId:       place,
      content,
      type,
      actionType
    });

    res.json({ username: user.username, content, type, actionType });
  } catch (err) {
    next(err);
  }
}

export async function getChatPage(
  req: Request,
  res: Response,
  next: Function
) {
  try {
    const user        = req.session.user;
    const environment = Number(req.params.envId);
    const place       = req.params.placeId ? Number(req.params.placeId) : undefined;
    if (!user) return res.redirect('/login');

    const env      = await envService.getEnvironmentById(environment);
    if (!env)      return res.redirect('/environments');

    const places   = await placeService.getPlaces(environment);
    const members  = await envService.getMembers(environment);
    const messages = await ChatService.getRecentMessages(environment, place);

    res.render('environment/chat', {
      title:         `${env.name} · ${place==null?'Lobby':places.find(p=>p.id===place)?.name}`,
      username:      user.username,
      env,
      places,
      members,
      messages,
      activePlaceId: place ?? null,
      csrfToken:     req.csrfToken()
    });
  } catch (err) {
    next(err);
  }
}
