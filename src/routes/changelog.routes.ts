import { Router } from 'express';
import { getChangelog } from '../controllers/changelog.controller';

const router = Router();

router.get('/changelog', getChangelog);

export default router;
