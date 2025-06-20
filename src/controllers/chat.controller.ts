import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';

export async function postChatMessage(req: Request, res: Response, next: Function) {
  try {
    const user        = req.session.user;
    const environment = Number(req.params.envId);
    const place       = req.params.placeId ? Number(req.params.placeId) : undefined;
    let { message }   = req.body;

    if (!user || !message) {
      return res.status(400).json({ error: 'Missing user or message' });
    }

    let type: 'chat'|'action' = 'chat';
    let actionType: 'me'|'do'|'rr'|null = null;
    let content = message;

    const slash = message.match(/^\/(me|do|rr)\s+(.+)$/i);
    if (slash) {
      type = 'action';
      actionType = slash[1].toLowerCase() as 'me'|'do'|'rr';
      content = slash[2].trim();
    }

    console.log('POST chat:', { raw:req.body.message, type, actionType, content });

    await ChatService.saveMessage({
      environmentId: environment,
      placeId:       place,
      userId:        user.id,
      content,
      type,
      actionType
    });

    res.json({ username: user.username, content, type, actionType });
  } catch (err) {
    next(err);
  }
}

export async function getChatPage(req: Request, res: Response, next: Function) {
  try {
    const user        = req.session.user;
    const environment = Number(req.params.envId);
    const place       = req.params.placeId ? Number(req.params.placeId) : undefined;

    if (!user) return res.redirect('/login');
    const msgs = await ChatService.getRecentMessages(environment, place);
    res.render('chat', { user, msgs });
  } catch (err) {
    next(err);
  }
}
