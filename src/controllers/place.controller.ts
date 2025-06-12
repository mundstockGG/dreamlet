// ...existing code...
import { Request, Response } from 'express';
import * as envService   from '../services/environment.service';
import * as placeService from '../services/place.service';

// ► GET /environments/:id/places/:placeId
export async function getPlaceView(req: Request, res: Response) {
  const userId  = req.session.user!.id;
  const envId   = Number(req.params.id);
  const placeId = Number(req.params.placeId);

  const env  = await envService.getEnvironmentById(envId);
  if (!env) return res.redirect('/environments');

  const role = await envService.getMemberRole(userId, envId);
  if (!role) return res.redirect('/environments');

  const places   = await placeService.getPlaces(envId);
  const members  = await envService.getMembers(envId);
  const place    = await placeService.getPlaceById(placeId);
  if (!place || place.envId !== envId) return res.redirect(`/environments/${envId}/chat`);

  // **NEW** load messages for this place
  const messages = await placeService.getPlaceMessages(placeId);

  res.render('environment/chat', {
    title: `${env.name} · ${place.name}`,
    username: req.session.user!.username,
    env,
    places,
    members,
    messages,
    activePlaceId: placeId
  });
}

// ► POST /environments/:id/places/:placeId/send
export async function postPlaceMessage(req: Request, res: Response) {
  const userId  = req.session.user!.id;
  const envId   = Number(req.params.id);
  const placeId = Number(req.params.placeId);
  const content = (req.body.message as string || '').trim();

  try {
    await placeService.createPlaceMessage(envId, placeId, userId, content);
  } catch (err:any) {
    req.flash('error', err.message);
  }
  res.redirect(`/environments/${envId}/places/${placeId}`);
}

// Show the “Edit Place” form
export async function getEditPlace(req: Request, res: Response) {
  const userId  = req.session.user!.id;
  const envId   = Number(req.params.id);
  const placeId = Number(req.params.placeId);

  const env  = await envService.getEnvironmentById(envId);
  if (!env) return res.redirect('/environments');
  const role = await envService.getMemberRole(userId, envId);
  if (!role) return res.status(403).send('Unauthorized');

  const place = await placeService.getPlaceById(placeId);
  if (!place || place.envId !== envId) return res.redirect(`/environments/${envId}`);

  if (role !== 'owner' && role !== 'moderator') {
    req.flash('error', 'Only owners or moderators may edit places');
    return res.redirect(`/environments/${envId}`);
  }

  const places = await placeService.getPlaces(envId);

  res.render('environments/edit-place', {
    title: `Edit Place: ${place.name}`,
    username: req.session.user!.username,
    env,
    place,
    places,
    error: null
  });
}

// Apply edits to a place
export async function postEditPlace(req: Request, res: Response) {
  const userId  = req.session.user!.id;
  const envId   = Number(req.params.id);
  const placeId = Number(req.params.placeId);
  const { name, emoji, parentId } = req.body;

  try {
    const place = await placeService.getPlaceById(placeId);
    if (!place || place.envId !== envId) throw new Error('Place not found');

    const role = await envService.getMemberRole(userId, envId);
    if (role !== 'owner' && role !== 'moderator') throw new Error('Unauthorized');

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

// Toggle place lock
export async function postTogglePlaceLock(req: Request, res: Response) {
  const userId  = req.session.user!.id;
  const envId   = Number(req.params.id);
  const placeId = Number(req.params.placeId);

  try {
    const place = await placeService.getPlaceById(placeId);
    if (!place || place.envId !== envId) throw new Error('Place not found');

    const role = await envService.getMemberRole(userId, envId);
    if (role !== 'owner' && role !== 'moderator') throw new Error('Unauthorized');

    await placeService.updatePlaceLock(placeId, !place.isLocked);
    req.flash('success', 'Place lock toggled');
  } catch (err: any) {
    req.flash('error', err.message);
  }
  res.redirect(`/environments/${envId}`);
}

// Delete a place
export async function deletePlace(req: Request, res: Response) {
  const userId  = req.session.user!.id;
  const envId   = Number(req.params.id);
  const placeId = Number(req.params.placeId);

  try {
    const env  = await envService.getEnvironmentById(envId);
    const role = await envService.getMemberRole(userId, envId);
    if (!env || (role !== 'owner' && role !== 'moderator')) {
      throw new Error('Unauthorized');
    }

    const place = await placeService.getPlaceById(placeId);
    if (place?.name === 'Lobby') {
      throw new Error('Cannot delete the Lobby');
    }

    await placeService.deletePlace(placeId);
    req.flash('success', 'Place deleted');
  } catch (err: any) {
    req.flash('error', err.message);
  }
  res.redirect(`/environments/${envId}`);
}
