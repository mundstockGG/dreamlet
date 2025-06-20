import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";

const localesPath    = path.join(process.cwd(), "src", "locales");
const defaultLang    = "en";
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
  let lang: string = req.session?.lang || defaultLang;

  if (!req.session?.lang) {
    const accepted = req.acceptsLanguages(supportedLangs);
    if (Array.isArray(accepted) && accepted.length > 0) {
      lang = accepted[0];
    }
  }

  const q = req.query.lang as string;
  if (q && supportedLangs.includes(q)) {
    lang = q;
    if (req.session) req.session.lang = q;
  }

  res.locals.t    = loadLocale(lang);
  res.locals.lang = lang;
  next();
}
