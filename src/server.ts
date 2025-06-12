import express from "express";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import authRoutes from "./routes/auth.routes";
import environmentRoutes from "./routes/environment.routes";
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
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false
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
  const lang = res.locals.lang || "en";
  const termsView = lang === "es" ? "terms.es" : "terms.en";
  res.render(termsView, {
    title: res.locals.t.footer_terms,
    username: req.session.user ? req.session.user.username : undefined,
    lang,
    t: res.locals.t
  });
});

// Auth and environment routes
app.use("/", authRoutes);
app.use("/environments", environmentRoutes);

// Home (hero)
app.get("/", (req, res) => {
  const user = req.session.user as undefined | { id: number; username: string };
  res.render("hero", {
    title: res.locals.t.hero && res.locals.t.hero.title ? res.locals.t.hero.title[0] : "Home",
    username: user ? user.username : undefined,
    lang: res.locals.lang,
    t: res.locals.t
  });
});

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("dashboard", { title: "Dashboard", username: req.session.user.username });
});

// Pricing
app.get("/pricing", (req, res) => {
  res.render("pricing", { title: "Pricing", username: req.session.user ? req.session.user.username : undefined });
});

// News
app.get("/news", (req, res) => {
  res.render("news", { title: "News", username: req.session.user ? req.session.user.username : undefined });
});

// Contact
app.get("/contact", (req, res) => {
  res.render("contact", { title: "Contact", username: req.session.user ? req.session.user.username : undefined });
});

// Changelog
app.get("/changelog", (req, res) => {
  res.render("changelog", { title: "Changelog", username: req.session.user ? req.session.user.username : undefined });
});

// Database 
pool.getConnection()
  .then(() => {
    console.log("✅ Connected to MySQL database");
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error("❌ DB connection error:", err);
    process.exit(1);
  });
