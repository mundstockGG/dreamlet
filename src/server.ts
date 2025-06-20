// src/server.ts
import dotenv from "dotenv";
import path from "path";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import http from "http";
import { Server as IOServer } from "socket.io";
import flash from "express-flash";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes";
import environmentRoutes from "./routes/environment.routes";
import newsRoutes from "./routes/news.routes";
import changelogRouter from "./routes/changelog.routes";
import pool from "./models/db.model";
import { i18nMiddleware } from "./middlewares/i18n.middleware";
import { csrfProtection, attachCsrfToken } from "./middlewares/csrf.middleware";
import { sanitizeBody } from "./middlewares/sanitize.middleware";
import { ChatService } from "./services/chat.service";
import * as envService from "./services/environment.service";
import * as placeService from "./services/place.service";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new IOServer(server);
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src", "views"));

const MySQLStoreFactory = require("express-mysql-session");
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const expressSession = session({
  secret:           process.env.SESSION_SECRET || "secret",
  resave:           false,
  saveUninitialized: false,
  store:            sessionStore,
  cookie: {
    secure:   process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
});
app.use(expressSession);

app.use(cookieParser()); 
app.use(csrfProtection); 
app.use(attachCsrfToken);

app.post("*", sanitizeBody);
app.put("*",  sanitizeBody);
app.delete("*", sanitizeBody);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  "Too many login attempts, please try again later.",
});
app.use(["/login", "/register", "/invite"], authLimiter);

try {
  const sharedSession = require("express-socket.io-session");
  io.use(sharedSession(expressSession, { autoSave: true }));
} catch {
  console.warn("express-socket.io-session not installed; skipping socket session sharing.");
}

app.use(i18nMiddleware);
app.use(flash());
app.use((req, res, next) => {
  console.log("Request:", req.method, req.originalUrl);
  next();
});

app.use("/",             authRoutes);
app.use("/environments", environmentRoutes);
app.use(newsRoutes);
app.use("/",             changelogRouter);

app.get("/terms", (req, res) => {
  const lang = req.query.lang === "es" ? "es" : "en";
  res.render(`terms/terms_${lang}`, {
    username: req.session.user?.username,
    lang:     res.locals.lang,
    t:        res.locals.t,
  });
});

app.get("/", (req, res) => {
  const lang = res.locals.lang === "es" ? "es" : "en";
  res.render(`main/hero_${lang}`, {
    username: req.session.user?.username,
    lang:     res.locals.lang,
    t:        res.locals.t,
  });
});

app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("environments/dashboard", {
    title:    res.locals.t.dashboard_title || "Dashboard",
    username: req.session.user.username,
    lang:     res.locals.lang,
    t:        res.locals.t,
  });
});

app.get("/pricing", (req, res) => {
  res.render("main/pricing", {
    title:    "Pricing",
    username: req.session.user?.username,
    lang:     res.locals.lang,
    t:        res.locals.t,
  });
});

app.get("/news", (req, res) => {
  res.render("main/news", {
    title:    "News",
    username: req.session.user?.username,
    lang:     res.locals.lang,
    t:        res.locals.t,
  });
});

app.get("/contact", (req, res) => {
  res.render("main/contact", {
    title:    "Contact",
    username: req.session.user?.username,
    lang:     res.locals.lang,
    t:        res.locals.t,
  });
});

app.get("/changelog", (req, res) => {
  res.render("main/changelog", {
    title:    "Changelog",
    username: req.session.user?.username,
    lang:     res.locals.lang,
    t:        res.locals.t,
  });
});

function processCommand(
  user: { id: number; username: string },
  envId: number,
  placeId: number | null,
  raw: string
) {
  const [cmd, ...rest] = raw.trim().split(" ");
  const arg = rest.join(" ");

  if (cmd === "/roll") {
    const m = arg.match(/^(\d*)d(\d+)$/i);
    if (!m) return { type: "error" as const, content: "Usage: /roll 2d6 or /roll d20" };
    const count = parseInt(m[1] || "1", 10);
    const sides = parseInt(m[2], 10);
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) {
      return { type: "error" as const, content: "Dice count must be 1–100, sides 2–1000" };
    }
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0);
    return { type: "roll" as const, username: user.username, count, sides, rolls, total, placeId, envId };
  }

  if (cmd === "/me") {
    if (!arg) return { type: "error" as const, content: "Usage: /me <action>" };
    return { type: "action" as const, username: user.username, content: arg, placeId, envId };
  }

  if (cmd === "/do") {
    if (!arg) return { type: "error" as const, content: "Usage: /do <description>" };
    return { type: "desc" as const, username: user.username, content: arg, placeId, envId };
  }

  return null;
}

io.on("connection", (socket) => {
  const session = (socket.handshake as any).session;
  const user    = session?.user;
  if (!user) return socket.disconnect();

  socket.on("joinEnv", async (envId: number) => {
    socket.join(`env:${envId}`);
    const msgs = await envService.getEnvironmentMessages(envId);
    socket.emit("initialLobbyMessages", msgs);
  });

  socket.on("joinPlace", async ({ envId, placeId }) => {
    socket.join(`env:${envId}:place:${placeId}`);
    const msgs = await placeService.getPlaceMessages(placeId);
    socket.emit("initialPlaceMessages", msgs);
  });

  socket.on("chat:send", async (raw: string) => {
    let type: "chat" | "action" = "chat";
    let actionType: "me" | "do" | "rr" | null = null;
    let content = raw;
    const slash = raw.match(/^\/(me|do|rr)\s+(.+)$/i);
    if (slash) {
      type       = "action";
      actionType = slash[1].toLowerCase() as any;
      content    = slash[2].trim();
    }
    await ChatService.saveMessage({
      actorId:       user.id,
      environmentId: (socket as any).environmentId,
      placeId:       (socket as any).placeId,
      content,
      type,
      actionType
    });
    io.to((socket as any).environmentRoom).emit("chat:receive", {
      username: user.username,
      content,
      type,
      actionType
    });
  });

  socket.on("typing", ({ envId, placeId }) => {
    if (!user.username) return;
    const room = placeId ? `env:${envId}:place:${placeId}` : `env:${envId}`;
    socket.to(room).emit("showTyping", { username: user.username, envId, placeId });
  });

  socket.on("lobbyMessage", async ({ envId, content }) => {
    const lobbyPlaceId = envId;
    const cmd          = processCommand(user, envId, lobbyPlaceId, content);

    if (cmd) {
      if (cmd.type === "roll") {
        const rollContent = `/roll ${cmd.count}d${cmd.sides}: ${cmd.rolls.join(", ")} = ${cmd.total}`;
        await ChatService.saveMessage({
          actorId:       user.id,
          environmentId: envId,
          placeId:       lobbyPlaceId,
          content:       rollContent,
          type:          "chat",
          actionType:    null
        });
        io.to(`env:${envId}`).emit("roll", cmd);
      } else if (cmd.type === "action") {
        await ChatService.saveMessage({
          actorId:       user.id,
          environmentId: envId,
          placeId:       lobbyPlaceId,
          content:       cmd.content,
          type:          "action",
          actionType:    "me"
        });
        io.to(`env:${envId}`).emit("action", { username: user.username, action: cmd.content });
      } else if (cmd.type === "desc") {
        await ChatService.saveMessage({
          actorId:       user.id,
          environmentId: envId,
          placeId:       lobbyPlaceId,
          content:       cmd.content,
          type:          "action",
          actionType:    "do"
        });
        io.to(`env:${envId}`).emit("desc", { username: user.username, text: cmd.content });
      } else if (cmd.type === "error") {
        socket.emit("errorMessage", cmd.content);
      }
      return;
    }

    await ChatService.saveMessage({
      actorId:       user.id,
      environmentId: envId,
      placeId:       lobbyPlaceId,
      content,
      type:          "chat",
      actionType:    null
    });
    io.to(`env:${envId}`).emit("lobbyMessage", {
      username:  user.username,
      content,
      createdAt: Date.now()
    });
  });

  socket.on("placeMessage", async ({ envId, placeId, content }) => {
    const cmd = processCommand(user, envId, placeId, content);

    if (cmd) {
      if (cmd.type === "roll") {
        const rollContent = `/roll ${cmd.count}d${cmd.sides}: ${cmd.rolls.join(", ")} = ${cmd.total}`;
        await ChatService.saveMessage({
          actorId:       user.id,
          environmentId: envId,
          placeId,
          content:       rollContent,
          type:          "chat",
          actionType:    null
        });
        io.to(`env:${envId}:place:${placeId}`).emit("roll", cmd);
      } else if (cmd.type === "action") {
        await ChatService.saveMessage({
          actorId:       user.id,
          environmentId: envId,
          placeId,
          content:       cmd.content,
          type:          "action",
          actionType:    "me"
        });
        io.to(`env:${envId}:place:${placeId}`).emit("action", { username: user.username, action: cmd.content });
      } else if (cmd.type === "desc") {
        await ChatService.saveMessage({
          actorId:       user.id,
          environmentId: envId,
          placeId,
          content:       cmd.content,
          type:          "action",
          actionType:    "do"
        });
        io.to(`env:${envId}:place:${placeId}`).emit("desc", { username: user.username, text: cmd.content });
      } else if (cmd.type === "error") {
        socket.emit("errorMessage", cmd.content);
      }
      return;
    }

    await ChatService.saveMessage({
      actorId:       user.id,
      environmentId: envId,
      placeId,
      content,
      type:          "chat",
      actionType:    null
    });
    io.to(`env:${envId}:place:${placeId}`).emit("placeMessage", {
      username:  user.username,
      content,
      createdAt: Date.now(),
      placeId
    });
  });
});

if (require.main === module) {
  pool.getConnection()
    .then(() => {
      console.log("✅ Connected to MySQL database");
      server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    })
    .catch(err => {
      console.error("❌ Database connection error:", err);
      process.exit(1);
    });
}

export default app;
