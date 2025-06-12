import express from "express";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import authRoutes from "./routes/auth.routes";
import environmentRoutes from "./routes/environment.routes";
import newsRoutes from "./routes/news.routes";
import changelogRouter from "./routes/changelog.routes";
import pool from "./models/db.model";
import { i18nMiddleware } from "./middlewares/i18n.middleware";
import flash from "express-flash";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true })); // Body parser
const publicPath = path.join(process.cwd(), "public");
app.use(express.static(publicPath)); // Static files
app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src", "views"));

const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore
  })
);
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

// Database 
pool.getConnection()
  .then(() => {
    console.log("✅ Connected to MySQL database");
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });
