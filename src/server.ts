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
