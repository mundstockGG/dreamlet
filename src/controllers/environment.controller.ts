import { Request, Response } from 'express';
import * as envService from '../services/environment.service';
import * as placeService from '../services/place.service';
import { ChatService } from '../services/chat.service';

export async function getEnvironments(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envs   = await envService.findByUser(userId);
  envs.forEach(env => {
    env.isOwner = env.ownerId === userId;
  });
  res.render('environments/environments', {
    title: 'My Environments',
    username: req.session.user!.username,
    environments: envs,
    error: null
  });
}

export async function getJoinEnvironment(req: Request, res: Response) {
  const error = req.flash('error');
  res.render('environment/join', {
    title: 'Join Environment',
    username: req.session.user!.username,
    error: error[0] || null
  });
}

export async function joinEnvironment(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const code   = (req.body.inviteCode as string || '').trim();
  try {
    const env = await envService.getEnvironmentByInviteCode(code);
    if (!env) throw new Error('Invalid invite code');
    if (env.isLocked) throw new Error('This environment is locked. You cannot join right now.');

    await envService.joinEnvironment(userId, code);
    res.redirect(`/environments/${env.id}/chat`);
  } catch (err: any) {
    res.render('environment/join', {
      title: 'Join Environment',
      username: req.session.user!.username,
      error: err.message
    });
  }
}

export async function postCreateEnvironment(req: Request, res: Response) {
  const userId   = req.session.user!.id;
  const { name, is_nsfw, difficulty, tags } = req.body;
  console.log('[DEBUG] postCreateEnvironment called');
  console.log('[DEBUG] userId:', userId);
  console.log('[DEBUG] name:', name);
  console.log('[DEBUG] is_nsfw:', is_nsfw);
  console.log('[DEBUG] difficulty:', difficulty);
  console.log('[DEBUG] tags:', tags);
  try {
    await envService.createEnvironment({
      ownerId: userId,
      name,
      isNSFW: Boolean(is_nsfw),
      difficulty,
      tags: (tags as string).split(',').map(t=>t.trim()).filter(Boolean)
    });
    req.flash('success','Environment created');
  } catch (err: any) {
    console.error('[DEBUG] Error in postCreateEnvironment:', err);
    req.flash('error', err.message);
  }
  res.redirect('/environments');
}

export async function leaveEnvironment(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId  = Number(req.params.id);
  try {
    await envService.leaveEnvironment(userId, envId);
    req.flash('success','Left environment');
  } catch (err: any) {
    req.flash('error', err.message);
  }
  res.redirect('/environments');
}

export async function getManageEnvironment(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId  = Number(req.params.id);
  const env     = await envService.getEnvironmentById(envId);
  if (!env) return res.redirect('/environments');

  if (env.ownerId !== userId) return res.redirect('/environments');

  const isMember = await envService.getMemberRole(userId, envId);
  if (!isMember) return res.redirect('/environments');

  const [members, places] = await Promise.all([
    envService.getMembers(envId),
    placeService.getPlaces(envId)
  ]);

  res.render('environments/environment', {
    title: `Manage: ${env.name}`,
    username: req.session.user!.username,
    env,
    members,
    places,
    error: null,
    t: res.locals.t,
    lang: res.locals.lang
  });
}

export async function getChat(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId  = Number(req.params.id);

  const env = await envService.getEnvironmentById(envId);
  if (!env) return res.redirect('/environments');
  const role = await envService.getMemberRole(userId, envId);
  if (!role) return res.redirect('/environments');

  const [members, places, messages] = await Promise.all([
    envService.getMembers(envId),
    placeService.getPlaces(envId),
    ChatService.getRecentMessages(envId)
  ]);

  res.render('environment/chat', {
    title: `${env.name} · Lobby`,
    username: req.session.user!.username,
    env,
    members,
    places,
    messages,
    activePlaceId: null
  });
}

export async function postChatMessage(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId  = Number(req.params.id);
  const raw    = (req.body.message as string || '').trim();

  // parse slash‐commands
  let type: 'chat'|'action'         = 'chat';
  let actionType: 'me'|'do'|'rr'|null = null;
  let content = raw;

  const slash = raw.match(/^\/(me|do|rr)\s+(.+)$/i);
  if (slash) {
    type       = 'action';
    actionType = slash[1].toLowerCase() as 'me'|'do'|'rr';
    content    = slash[2].trim();
  }

  // save with ChatService (six columns!)
  await ChatService.saveMessage({
    environmentId: envId,
    placeId:       undefined,
    userId,
    content,
    type,
    actionType
  });

  res.redirect(`/environments/${envId}/chat`);
}

export async function toggleEnvironmentLock(req: Request, res: Response) {
  const envId  = Number(req.params.id);
  const userId = req.session.user!.id;
  const env    = await envService.getEnvironmentById(envId);
  if (!env || env.ownerId !== userId) return res.status(403).send('Unauthorized');
  await envService.updateLockState(envId, !env.isLocked);
  res.redirect(`/environments/${envId}`);
}
export async function promoteUser(req: Request, res: Response) {
  const envId    = Number(req.params.id);
  const ownerId  = req.session.user!.id;
  const memberId = Number(req.params.memberId);
  const env      = await envService.getEnvironmentById(envId);
  if (!env || env.ownerId !== ownerId) return res.status(403).send('Unauthorized');
  await envService.promoteMember(envId, memberId);
  res.redirect(`/environments/${envId}`);
}

export async function kickUser(req: Request, res: Response) {
  const envId    = Number(req.params.id);
  const ownerId  = req.session.user!.id;
  const memberId = Number(req.params.memberId);
  const env      = await envService.getEnvironmentById(envId);
  if (!env || env.ownerId !== ownerId) return res.status(403).send('Unauthorized');
  await envService.kickMember(envId, memberId);
  res.redirect(`/environments/${envId}`);
}

export async function banUser(req: Request, res: Response) {
  const envId    = Number(req.params.id);
  const ownerId  = req.session.user!.id;
  const memberId = Number(req.params.memberId);
  const env      = await envService.getEnvironmentById(envId);
  if (!env || env.ownerId !== ownerId) return res.status(403).send('Unauthorized');
  await envService.banMember(envId, memberId);
  res.redirect(`/environments/${envId}`);
}

export async function muteUser(req: Request, res: Response) {
  const envId    = Number(req.params.id);
  const ownerId  = req.session.user!.id;
  const memberId = Number(req.params.memberId);
  const env      = await envService.getEnvironmentById(envId);
  if (!env || env.ownerId !== ownerId) return res.status(403).send('Unauthorized');
  await envService.toggleMuteMember(envId, memberId);
  res.redirect(`/environments/${envId}`);
}

export async function postCreatePlace(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId = Number(req.params.id);
  const { name, emoji, parentId } = req.body;

  try {
    const role = await envService.getMemberRole(userId, envId);
    if (role !== 'owner' && role !== 'moderator') throw new Error('Unauthorized');
    await placeService.createPlace(envId, name, emoji, parentId ? Number(parentId) : null);
    req.flash('success', 'Place created');
  } catch (err: any) {
    req.flash('error', err.message);
  }
  res.redirect(`/environments/${envId}`);
}
