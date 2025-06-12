import { Request, Response } from 'express';
import { registerUser, findUserByUsername } from '../services/auth.service';
import bcrypt from 'bcrypt';

export const getLogin = (req: Request, res: Response) => {
  res.render('auth/login', { title: 'Login', username: req.session.user?.username, error: null });
};

export const postLogin = async (req: Request, res: Response) => {
  const { username, password, rememberMe } = req.body;
  const user = await findUserByUsername(username);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.render('auth/login', { title: 'Login', username: req.session.user?.username, error: 'Invalid credentials' });
  }
  req.session.user = { id: user.id, username: user.username };
  // Set session cookie maxAge if rememberMe is checked
  if (rememberMe) {
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
  } else {
    req.session.cookie.expires = undefined; // Session cookie (expires on browser close)
  }
  res.redirect('/dashboard');
};

export const getRegister = (req: Request, res: Response) => {
  res.render('auth/register', { title: 'Register', username: req.session.user?.username, error: null });
};

export const postRegister = async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await registerUser(username, email, hashed);
    res.redirect('/login');
  } catch {
    res.render('auth/register', { title: 'Register', username: req.session.user?.username, error: 'Username or email already exists' });
  }
};

export const logout = (req: Request, res: Response) => {
  req.session.destroy(() => res.redirect('/'));
};
