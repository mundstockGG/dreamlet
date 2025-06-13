import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import environmentRoutes from "./routes/environment.routes";
import newsRoutes from "./routes/news.routes";
import changelogRouter from "./routes/changelog.routes";
import pool from "./models/db.model";
import { i18nMiddleware } from "./middlewares/i18n.middleware";
import flash from "express-flash";
import * as envService from './services/environment.service';
import * as placeService from './services/place.service';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new IOServer(server);
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true })); // Body parser
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath)); // Static files
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src", "views"));

const MySQLStoreFactory = require('express-mysql-session');
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
const expressSession = session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: false,
  store: sessionStore
});
app.use(expressSession);
// Share session data with socket handlers:
try {
  const sharedSession = require("express-socket.io-session");
  io.use(sharedSession(expressSession, { autoSave: true }));
} catch (e) {
  console.warn('express-socket.io-session not installed, skipping socket session sharing.');
}
app.use(i18nMiddleware);
app.use(flash());
app.use((req, res, next) => {
  console.log("Request:", req.method, req.originalUrl);
  next();
});

// Terms and Conditions page
app.get("/terms", (req, res) => {
  const lang = res.locals.lang === "es" ? "es" : "en";
  res.render(`terms/terms.${lang}`, {
    title: res.locals.t.footer_terms,
    username: req.session.user?.username,
    lang,
    t: res.locals.t
  });
});

// Auth and environment routes
app.use("/", authRoutes);
app.use("/environments", environmentRoutes);

// News (from Markdown files)
app.use(newsRoutes);

// Changelog
app.use("/", changelogRouter);

// Home (hero)
app.get("/", (req, res) => {
  const user = req.session.user as undefined | { id: number; username: string };
  res.render("main/hero", {
    title: res.locals.t.hero && res.locals.t.hero.title ? res.locals.t.hero.title[0] : "Home",
    username: user ? user.username : undefined,
    lang: res.locals.lang,
    t: res.locals.t
  });
});

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("environments/dashboard", {
    title: res.locals.t.dashboard_title || "Dashboard",
    username: req.session.user.username,
    lang: res.locals.lang,
    t: res.locals.t
  });
});

// Pricing
app.get("/pricing", (req, res) => {
  res.render("main/pricing", {
    title: "Pricing",
    username: req.session.user ? req.session.user.username : undefined,
    lang: res.locals.lang,
    t: res.locals.t
  });
});

// News
app.get("/news", (req, res) => {
  res.render("main/news", {
    title: "News",
    username: req.session.user ? req.session.user.username : undefined,
    lang: res.locals.lang,
    t: res.locals.t
  });
});

// Contact
app.get("/contact", (req, res) => {
  res.render("main/contact", {
    title: "Contact",
    username: req.session.user ? req.session.user.username : undefined,
    lang: res.locals.lang,
    t: res.locals.t
  });
});

// Changelog
app.get("/changelog", (req, res) => {
  res.render("main/changelog", {
    title: "Changelog",
    username: req.session.user ? req.session.user.username : undefined,
    lang: res.locals.lang,
    t: res.locals.t
  });
});

// Helper to parse and execute slash‐commands
function processCommand(
  user: { id:number; username:string },
  envId: number,
  placeId: number | null,
  raw: string
) {
  const [cmd, ...rest] = raw.trim().split(' ');
  const arg = rest.join(' ');

  if (cmd === '/roll') {
    // match NdM or dM
    const m = arg.match(/^(\d*)d(\d+)$/i);
    if (!m) {
      return { type: 'error', content: `Usage: /roll 2d6 or /roll d20` };
    }
    const count = parseInt(m[1] || '1', 10);
    const sides = parseInt(m[2], 10);
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
      return { type: 'error', content: 'Dice count must be 1–100, sides 2–1000' };
    }
    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(1 + Math.floor(Math.random() * sides));
    }
    const total = rolls.reduce((a,b) => a+b, 0);
    return {
      type: 'roll',
      username: user.username,
      count, sides,
      rolls,
      total,
      placeId,
      envId
    };
  }

  if (cmd === '/me') {
    if (!arg) {
      return { type: 'error', content: 'Usage: /me <action>' };
    }
    return {
      type: 'action',
      username: user.username,
      content: arg,
      placeId,
      envId
    };
  }

  if (cmd === '/do') {
    if (!arg) {
      return { type: 'error', content: 'Usage: /do <description>' };
    }
    return {
      type: 'desc',
      username: user.username,
      content: arg,
      placeId,
      envId
    };
  }

  // not a recognized command
  return null;
}

// Socket.IO logic:
io.on('connection', (socket) => {
  // Typing indicator
  socket.on('typing', ({ envId, placeId }) => {
    const user = (socket.handshake && (socket.handshake as any).session && (socket.handshake as any).session.user) || {};
    if (!user.username) return;
    if (placeId) {
      // Place chat
      socket.to(`env:${envId}:place:${placeId}`).emit('showTyping', { username: user.username, envId, placeId });
    } else {
      // Lobby chat
      socket.to(`env:${envId}`).emit('showTyping', { username: user.username, envId });
    }
  });
  const user = (socket.handshake as any).session?.user;
  if (!user) {
    return socket.disconnect();
  }

  // Lobby join: only fetch lobby messages (place_id IS NULL)
  socket.on('joinEnv', async (envId: number) => {
    socket.join(`env:${envId}`);
    // Only fetch lobby messages (place_id IS NULL)
    const msgs = await envService.getEnvironmentMessages(envId);
    socket.emit('initialLobbyMessages', msgs);
  });

  // Place join: only fetch messages for that place
  socket.on('joinPlace', async ({ envId, placeId }) => {
    socket.join(`env:${envId}:place:${placeId}`);
    const msgs = await placeService.getPlaceMessages(placeId);
    socket.emit('initialPlaceMessages', msgs);
  });

  // Lobby message: only broadcast to lobby (env:<id>)
  socket.on('lobbyMessage', async ({ envId, content }) => {
    const cmd = processCommand(user, envId, null, content);
    if (cmd) {
      if (cmd.type === 'roll') {
        const { count, sides, rolls, total, username } = cmd;
        io.to(`env:${envId}`).emit('roll', { username, count, sides, rolls, total });
      } else if (cmd.type === 'action') {
        io.to(`env:${envId}`).emit('action', { username: cmd.username, action: cmd.content });
      } else if (cmd.type === 'desc') {
        io.to(`env:${envId}`).emit('desc', { username: cmd.username, text: cmd.content });
      } else if (cmd.type === 'error') {
        socket.emit('errorMessage', cmd.content);
      }
      return;
    }
    await envService.createEnvironmentMessage(envId, user.id, content);
    io.to(`env:${envId}`)
      .emit('lobbyMessage', {
        username: user.username,
        content,
        createdAt: Date.now()
      });
  });

  // Place message: only broadcast to place (env:<id>:place:<placeId>)
  socket.on('placeMessage', async ({ envId, placeId, content }) => {
    const cmd = processCommand(user, envId, placeId, content);
    if (cmd) {
      if (cmd.type === 'roll') {
        const { count, sides, rolls, total, username } = cmd;
        io.to(`env:${envId}:place:${placeId}`).emit('roll', { username, count, sides, rolls, total });
      } else if (cmd.type === 'action') {
        io.to(`env:${envId}:place:${placeId}`).emit('action', { username: cmd.username, action: cmd.content });
      } else if (cmd.type === 'desc') {
        io.to(`env:${envId}:place:${placeId}`).emit('desc', { username: cmd.username, text: cmd.content });
      } else if (cmd.type === 'error') {
        socket.emit('errorMessage', cmd.content);
      }
      return;
    }
    await placeService.createPlaceMessage(envId, placeId, user.id, content);
    io.to(`env:${envId}:place:${placeId}`)
      .emit('placeMessage', {
        username: user.username,
        content,
        createdAt: Date.now(),
        placeId
      });
  });
});

// Database 
pool.getConnection()
  .then(() => {
    console.log("✅ Connected to MySQL database");
    server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });
