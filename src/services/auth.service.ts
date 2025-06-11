import pool from '../models/db.model';

export const registerUser = async (username: string, email: string, passwordHash: string) => {
  const sql = 'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)';
  await pool.execute(sql, [username, email, passwordHash]);
};

export const findUserByUsername = async (username: string) => {
  const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
  return (rows as any[])[0] || null;
};
