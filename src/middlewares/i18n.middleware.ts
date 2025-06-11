import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";

const localesPath = path.join(process.cwd(), "src", "locales");
const defaultLang = "en";
const supportedLangs = ["en", "es"];

function loadLocale(lang: string) {
  try {
    if (!supportedLangs.includes(lang)) lang = defaultLang;
    const file = path.join(localesPath, `${lang}.json`);
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

export function i18nMiddleware(req: Request, res: Response, next: NextFunction) {
  let lang = req.session?.lang || req.acceptsLanguages(supportedLangs) || defaultLang;
  if (req.query.lang && supportedLangs.includes(req.query.lang as string)) {
    lang = req.query.lang as string;
    if (req.session) req.session.lang = lang;
  }
  res.locals.t = loadLocale(lang);
  res.locals.lang = lang;
  next();
}
