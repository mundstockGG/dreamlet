import { Request, Response } from 'express';
import * as envService from '../services/environment.service';
import * as placeService from '../services/place.service';

// 1️⃣ List “My Environments”
export async function getEnvironments(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envs   = await envService.findByUser(userId);
  // Mark environments owned by the user
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

// 2️⃣ Show Join‐by‐Code form
export async function getJoinEnvironment(req: Request, res: Response) {
  const error = req.flash('error');
  res.render('environment/join', {
    title: 'Join Environment',
    username: req.session.user!.username,
    error: error[0] || null
  });
}

// 3️⃣ Handle Join POST → redirect to lobby chat
export async function joinEnvironment(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const code   = (req.body.inviteCode as string || '').trim();
  try {
    await envService.joinEnvironment(userId, code);
    // Now fetch env to get ID
    const env = await envService.getEnvironmentByInviteCode(code);
    res.redirect(`/environments/${env!.id}/chat`);
  } catch (err: any) {
    req.flash('error', err.message);
    res.redirect('/environments/join');
  }
}

// 4️⃣ Create Environment
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

// 5️⃣ Leave
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

// 6️⃣ Manage Environment (settings + places + members)
export async function getManageEnvironment(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId  = Number(req.params.id);
  const env     = await envService.getEnvironmentById(envId);
  if (!env) return res.redirect('/environments');

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
    error: null
  });
}

// 7️⃣ Lobby Chat GET
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
    envService.getEnvironmentMessages(envId)
  ]);

  res.render('environment/chat', {
    title: `${env.name} · Lobby`,
    username: req.session.user!.username,
    env,
    members,
    places,
    messages,
    activePlaceId: null // Ensure this is always defined for EJS
  });
}

// 8️⃣ Lobby Chat POST
export async function postChatMessage(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId  = Number(req.params.id);
  const content = (req.body.message as string || '').trim();

  try {
    await envService.createEnvironmentMessage(envId, userId, content);
  } catch (err:any) {
    req.flash('error', err.message);
  }
  res.redirect(`/environments/${envId}/chat`);
}

// 9️⃣ Moderation & Locking (owner only)…
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

// Create a new place (sub-chat)
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
