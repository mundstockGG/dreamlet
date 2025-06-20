import { Request, Response } from 'express';
import { registerUser, findUserByUsername } from '../services/auth.service';
import bcrypt from 'bcrypt';

export const getLogin = (req: Request, res: Response, next: Function) => {
  try {
    res.render('auth/login', { title: 'Login', username: req.session.user?.username, error: null });
  } catch (err) {
    next(err);
  }
};

export const postLogin = async (req: Request, res: Response, next: Function) => {
  try {
    const { username, password, rememberMe } = req.body;
    const user = await findUserByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.render('auth/login', { title: 'Login', username: req.session.user?.username, error: 'Invalid credentials' });
    }
    req.session.user = { id: user.id, username: user.username };
    if (rememberMe) {
      req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
    } else {
      req.session.cookie.expires = undefined;
    }
    res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
};

export const getRegister = (req: Request, res: Response, next: Function) => {
  try {
    res.render('auth/register', { title: 'Register', username: req.session.user?.username, error: null });
  } catch (err) {
    next(err);
  }
};

export const postRegister = async (req: Request, res: Response, next: Function) => {
  try {
    const { username, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    try {
      await registerUser(username, email, hashed);
      res.redirect('/login');
    } catch {
      res.render('auth/register', { title: 'Register', username: req.session.user?.username, error: 'Username or email already exists' });
    }
  } catch (err) {
    next(err);
  }
};

export const logout = (req: Request, res: Response, next: Function) => {
  try {
    req.session.destroy(() => res.redirect('/'));
  } catch (err) {
    next(err);
  }
};
