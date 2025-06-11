import { Router } from 'express';
import {
  getEnvironments,
  postCreateEnvironment,
  joinEnvironment,
  leaveEnvironment,
  getManageEnvironment,
  postCreatePlace
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

export default router;
