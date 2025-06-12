import { Router } from 'express';
import {
  getEnvironments,
  postCreateEnvironment,
  joinEnvironment,
  leaveEnvironment,
  getManageEnvironment,
  postCreatePlace,
  getEditPlace,
  postEditPlace,
  postTogglePlaceLock,
  toggleEnvironmentLock,
  promoteUser,
  kickUser,
  banUser,
  muteUser
  ,getPlaceView
  ,deletePlace
} from '../controllers/environment.controller';
import { ensureAuth } from '../middlewares/auth.middleware';

const router = Router();
router.use(ensureAuth);

router.get('/',             getEnvironments);
router.post('/create',      postCreateEnvironment);
router.post('/join',        joinEnvironment);
router.post('/:id/leave',   leaveEnvironment);

router.get('/:id',          getManageEnvironment);
router.post('/:id/lock',    toggleEnvironmentLock);

// Places
router.post('/:id/places/create',             postCreatePlace);
router.get('/:id/places/:placeId/edit',       getEditPlace);
router.post('/:id/places/:placeId/edit',      postEditPlace);
router.post('/:id/places/:placeId/lock',      postTogglePlaceLock);

// View a place
router.get('/:id/places/:placeId', getPlaceView);

// Delete a place
router.post('/:id/places/:placeId/delete', deletePlace);

// Moderation
router.post('/:id/members/:memberId/promote', promoteUser);
router.post('/:id/members/:memberId/kick',    kickUser);
router.post('/:id/members/:memberId/ban',     banUser);
router.post('/:id/members/:memberId/mute',    muteUser);

export default router;
