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
  postCreatePlace     // ← stays here
} from '../controllers/environment.controller';
import {
  getPlaceView,
  postPlaceMessage, // ← NEW
  getEditPlace,
  postEditPlace,
  postTogglePlaceLock,
  deletePlace
} from '../controllers/place.controller';

const router = Router();
router.use(ensureAuth);

// Environment list & create
router.get('/',            getEnvironments);
router.get('/join',        getJoinEnvironment);
router.post('/create',     postCreateEnvironment);
router.post('/join',       joinEnvironment);
router.post('/:id/leave',  leaveEnvironment);

// Manage & settings
router.get('/:id',         getManageEnvironment);
router.post('/:id/lock',   toggleEnvironmentLock);

// Lobby chat
router.get('/:id/chat',         getChat);
router.post('/:id/chat/send',   postChatMessage);

// Places as sub‐chats:
router.post('/:id/places', postCreatePlace);              // create a new place
router.get('/:id/places/:placeId',       getPlaceView);   // show that place’s chat
router.post('/:id/places/:placeId/send', postPlaceMessage); // post into that place’s chat
router.get('/:id/places/:placeId/edit',  getEditPlace);
router.post('/:id/places/:placeId/edit', postEditPlace);
router.post('/:id/places/:placeId/lock', postTogglePlaceLock);
router.post('/:id/places/:placeId/delete', deletePlace);

// Moderation (owner only)
router.post('/:id/members/:memberId/promote', promoteUser);
router.post('/:id/members/:memberId/kick',    kickUser);
router.post('/:id/members/:memberId/ban',     banUser);
router.post('/:id/members/:memberId/mute',    muteUser);

export default router;
