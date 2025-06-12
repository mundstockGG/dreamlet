import { Request, Response } from 'express';
// Use require here too:
const { validationResult } = require('express-validator');
import * as envService   from '../services/environment.service';
import * as placeService from '../services/place.service';

// Tier limits
const BASIC_ENV_LIMIT = 3;

export async function getEnvironments(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envs = await envService.findByUser(userId);
  res.render('environments', { title: 'My Environments', username: req.session.user!.username, environments: envs, error: null });
}

// ─── Create Environment ──────────────────────────────────────
export async function postCreateEnvironment(req: Request, res: Response) {
  // 1) validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map((e: any) => e.msg).join('; '));
    return res.redirect('/environments');
  }

  const userId     = req.session.user!.id;
  const { name, is_nsfw, tags, difficulty } = req.body;

  try {
    // 2) Enforce basic tier env limit
    if (req.session.user!.tier === 'basic') {
      const count = await envService.countEnvironmentsByUser(userId);
      if (count >= BASIC_ENV_LIMIT) {
        throw new Error(`Basic tier allows only ${BASIC_ENV_LIMIT} environments`);
      }
    }

    // 3) Create environment (w/ lobby & membership)
    await envService.createEnvironment({
      ownerId:  userId,
      name,
      isNSFW:   Boolean(is_nsfw),
      difficulty,
      tags:     (tags as string).split(',').map(t => t.trim()).filter(Boolean)
    });

    req.flash('success', 'Environment created successfully');
    res.redirect('/environments');
  } catch (err: any) {
    req.flash('error', err.message);
    res.redirect('/environments');
  }
}

// ─── Join Environment ───────────────────────────────────────
export async function joinEnvironment(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map((e: any) => e.msg).join('; '));
    return res.redirect('/environments');
  }

  const userId = req.session.user!.id;
  const code = req.body.inviteCode?.trim();
  try {
    await envService.joinEnvironment(userId, code);
    res.redirect('/environments');
  } catch (err: any) {
    const envs = await envService.findByUser(userId);
    res.render('environments', { title: 'My Environments', username: req.session.user!.username, environments: envs, error: err.message });
  }
}

export async function leaveEnvironment(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId = Number(req.params.id);
  try {
    await envService.leaveEnvironment(userId, envId);
    res.redirect('/environments');
  } catch (err: any) {
    const envs = await envService.findByUser(userId);
    res.render('environments', { title: 'My Environments', username: req.session.user!.username, environments: envs, error: err.message });
  }
}

export async function getManageEnvironment(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId = Number(req.params.id);
  const env = await envService.getEnvironmentById(envId);
  if (!env) return res.redirect('/environments');
  const isMember = await envService.isUserMember(userId, envId);
  if (!isMember) return res.redirect('/environments');
  const [members, places] = await Promise.all([
    envService.getMembers(envId),
    placeService.getPlaces(envId)
  ]);
  res.render('environment', { title: `Manage: ${env.name}`, username: req.session.user!.username, env, members, places, error: null });
}

export async function postCreatePlace(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId = Number(req.params.id);
  const { name, emoji, parentId } = req.body;
  try {
    await placeService.createPlace(
      envId,
      name,
      emoji,
      parentId ? Number(parentId) : null
    );
    res.redirect(`/environments/${envId}`);
  } catch (err: any) {
    const env = await envService.getEnvironmentById(envId);
    const members = await envService.getMembers(envId);
    const places = await placeService.getPlaces(envId);
    res.render('environment', { title: `Manage: ${env?.name}`, username: req.session.user!.username, env, members, places, error: err.message });
  }
}

// ─── Environment Lock ──────────────────────────────────────
export async function toggleEnvironmentLock(req: Request, res: Response) {
  const envId  = Number(req.params.id);
  const userId = req.session.user!.id;
  const env    = await envService.getEnvironmentById(envId);
  if (!env || env.ownerId !== userId) return res.status(403).send('Unauthorized');
  await envService.updateLockState(envId, !env.isLocked);
  res.redirect(`/environments/${envId}`);
}

// ─── Member Moderation ─────────────────────────────────────
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

// Place edit/lock handlers (use placeService for updates)
export async function getEditPlace(req: Request, res: Response) {
  const userId  = req.session.user!.id;
  const envId   = Number(req.params.id);
  const placeId = Number(req.params.placeId);

  // 1. Check env exists & membership
  const env  = await envService.getEnvironmentById(envId);
  if (!env) return res.redirect('/environments');

  const role = await envService.getMemberRole(userId, envId);
  if (!role) return res.status(403).send('Unauthorized');

  // 2. Load the place
  const place = await placeService.getPlaceById(placeId);
  if (!place || place.envId !== envId) {
    return res.redirect(`/environments/${envId}`);
  }

  if (role !== 'owner' && role !== 'moderator') {
    req.flash('error', 'Only owners or moderators may edit places');
    return res.redirect(`/environments/${envId}`);
  }

  // 3. Load all places for the “parent” dropdown
  const places = await placeService.getPlaces(envId);

  // 4. Render
  res.render('edit-place', {
    title: `Edit Place: ${place.name}`,
    username: req.session.user!.username,
    env,
    place,
    places,
    error: null
  });
}

export async function postEditPlace(req: Request, res: Response) {
  const userId  = req.session.user!.id;
  const envId   = Number(req.params.id);
  const placeId = Number(req.params.placeId);
  const { name, emoji, parentId } = req.body;

  try {
    const place = await placeService.getPlaceById(placeId);
    if (!place || place.envId !== envId) throw new Error('Place not found');

    const role = await envService.getMemberRole(userId, envId);
    if (role !== 'owner' && role !== 'moderator') {
      throw new Error('Unauthorized');
    }

    await placeService.updatePlace(
      placeId,
      name,
      emoji,
      parentId ? Number(parentId) : null
    );

    req.flash('success', 'Place updated');
  } catch (err: any) {
    req.flash('error', err.message);
  }
  res.redirect(`/environments/${envId}`);
}

export async function postTogglePlaceLock(req: Request, res: Response) {
  const userId  = req.session.user!.id;
  const envId   = Number(req.params.id);
  const placeId = Number(req.params.placeId);

  try {
    const place = await placeService.getPlaceById(placeId);
    if (!place || place.envId !== envId) throw new Error('Place not found');

    const role = await envService.getMemberRole(userId, envId);
    if (role !== 'owner' && role !== 'moderator') {
      throw new Error('Unauthorized');
    }

    await placeService.updatePlaceLock(placeId, !place.isLocked);
    req.flash('success', 'Place lock toggled');
  } catch (err: any) {
    req.flash('error', err.message);
  }
  res.redirect(`/environments/${envId}`);
}
