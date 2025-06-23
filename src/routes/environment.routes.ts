import { Router } from 'express';
import { ensureAuth } from '../middlewares/auth.middleware';
import {
  getEnvironments,
  getJoinEnvironment,
  postCreateEnvironment,
  joinEnvironment,
  leaveEnvironment,
  getManageEnvironment,
  getChat,
  postChatMessage,
  toggleEnvironmentLock,
  promoteUser,
  kickUser,
  banUser,
  muteUser,
  postCreatePlace,
  getEnvironmentDetail,
  deleteEnvironmentAuth
} from '../controllers/environment.controller';
import {
  getPlaceView,
  postPlaceMessage,
  getEditPlace,
  postEditPlace,
  postTogglePlaceLock,
  deletePlace
} from '../controllers/place.controller';

const router = Router();
router.use(ensureAuth);

router.get('/',             getEnvironments);
router.get('/join',         getJoinEnvironment);
router.post('/create',      postCreateEnvironment);
router.post('/join',        joinEnvironment);
router.post('/:id/leave',   leaveEnvironment);

router.get('/:id',          getEnvironmentDetail);
router.post('/:id/lock',    toggleEnvironmentLock);

router.get('/:id/chat',      getChat);
router.post('/:id/chat/send', postChatMessage);

router.post('/:id/places',          postCreatePlace);
router.get('/:id/places/:placeId',         getPlaceView);
router.post('/:id/places/:placeId/send',   postPlaceMessage);
router.get('/:id/places/:placeId/edit',    getEditPlace);
router.post('/:id/places/:placeId/edit',   postEditPlace);
router.post('/:id/places/:placeId/lock',   postTogglePlaceLock);
router.post('/:id/places/:placeId/delete', deletePlace);

router.post('/:id/members/:memberId/promote', promoteUser);
router.post('/:id/members/:memberId/kick',    kickUser);
router.post('/:id/members/:memberId/ban',     banUser);
router.post('/:id/members/:memberId/mute',    muteUser);

router.post('/:id/delete', getEnvironmentDetail);
router.post('/:id/delete', deleteEnvironmentAuth);

export default router;
