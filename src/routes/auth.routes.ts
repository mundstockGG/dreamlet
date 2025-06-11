import { Router } from 'express';
import { getLogin, postLogin, getRegister, postRegister, logout } from '../controllers/auth.controller';

const router = Router();

router.get('/login', getLogin);
router.post('/login', postLogin);
router.get('/register', getRegister);
router.post('/register', postRegister);
router.get('/logout', logout);

export default router;
