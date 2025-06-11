import { Router } from 'express';
import {
  getEnvironments,
  postCreateEnvironment,
  joinEnvironment,
  leaveEnvironment,
  getManageEnvironment,
  postCreatePlace,
  toggleEnvironmentLock,
  promoteUser,
  kickUser,
  banUser,
  muteUser
} from '../controllers/environment.controller';
import { ensureAuth } from '../middlewares/auth.middleware';

const router = Router();
router.use(ensureAuth);

router.get('/', getEnvironments);
router.post('/create', postCreateEnvironment);
router.post('/join', joinEnvironment);
router.post('/:id/leave', leaveEnvironment);
router.get('/:id', getManageEnvironment);
router.post('/:id/places/create', postCreatePlace);
router.post('/:id/lock', toggleEnvironmentLock);
// Member moderation (owners only)
router.post('/:id/members/:memberId/promote', promoteUser);
router.post('/:id/members/:memberId/kick',    kickUser);
router.post('/:id/members/:memberId/ban',     banUser);
router.post('/:id/members/:memberId/mute',    muteUser);

export default router;
