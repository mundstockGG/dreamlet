import { Request, Response } from 'express';
import * as envService from '../services/environment.service';

export async function getEnvironments(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envs = await envService.findByUser(userId);
  res.render('environments', { title: 'My Environments', username: req.session.user!.username, environments: envs, error: null });
}

export async function postCreateEnvironment(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const { name, is_nsfw, tags } = req.body;
  try {
    await envService.createEnvironment({ ownerId: userId, name, isNSFW: Boolean(is_nsfw), tags: (tags as string).split(',').map(t => t.trim()).filter(t => t) });
    res.redirect('/environments');
  } catch {
    const envs = await envService.findByUser(userId);
    res.render('environments', { title: 'My Environments', username: req.session.user!.username, environments: envs, error: 'Could not create environment' });
  }
}

export async function joinEnvironment(req: Request, res: Response) {
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
  const [members, places] = await Promise.all([ envService.getMembers(envId), envService.getPlaces(envId) ]);
  res.render('environment', { title: `Manage: ${env.name}`, username: req.session.user!.username, env, members, places, error: null });
}

export async function postCreatePlace(req: Request, res: Response) {
  const userId = req.session.user!.id;
  const envId = Number(req.params.id);
  const { name, emoji, parentId } = req.body;
  try {
    await envService.createPlace({ environmentId: envId, name, emoji, parentId: parentId ? Number(parentId) : null });
    res.redirect(`/environments/${envId}`);
  } catch (err: any) {
    const env = await envService.getEnvironmentById(envId);
    const members = await envService.getMembers(envId);
    const places = await envService.getPlaces(envId);
    res.render('environment', { title: `Manage: ${env?.name}`, username: req.session.user!.username, env, members, places, error: err.message });
  }
}
