import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';

export async function postChatMessage(req: Request, res: Response) {
  const user        = req.session.user;
  const environment = Number(req.params.envId);
  const place       = req.params.placeId ? Number(req.params.placeId) : undefined;
  let { message }   = req.body;

  if (!user || !message) {
    return res.status(400).json({ error: 'Missing user or message' });
  }

  let type: 'chat'|'action' = 'chat';
  const m = message.match(/^\/me\s+(.+)$/i);
  if (m) {
    type    = 'action';
    message = m[1].trim();
  }

  console.log('POST chat:', { raw:req.body.message, type, message });

  await ChatService.saveMessage({
    environmentId: environment,
    placeId:       place,
    userId:        user.id,
    content:       message,
    type
  });

  res.json({ username: user.username, content: message, type });
}

export async function getChatPage(req: Request, res: Response) {
  const user        = req.session.user;
  const environment = Number(req.params.envId);
  const place       = req.params.placeId ? Number(req.params.placeId) : undefined;

  if (!user) return res.redirect('/login');
  const msgs = await ChatService.getRecentMessages(environment, place);
  res.render('chat', { user, msgs });
}
