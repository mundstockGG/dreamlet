import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

interface NewsItem {
  slug: string;
  title: string;
  date: string;
  description: string;
  banner: string;
  html: string;
}

const router = Router();
const mdDir = path.join(process.cwd(), 'public', 'markdown');

// Load & parse all Markdown files once on startup
const newsList: NewsItem[] = fs
  .readdirSync(mdDir)
  .filter((f) => f.endsWith('.md'))
  .map((filename) => {
    const slug = filename.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(mdDir, filename), 'utf-8');
    const { data, content } = matter(raw);

    // Convert Markdown to HTML (cast to string to satisfy NewsItem.html)
    const htmlString = marked.parse(content) as string;

    return {
      slug,
      title: data.title,
      date: data.date,
      description: data.description,
      banner: data.banner,
      html: htmlString,
    };
  })
  .sort(
    (a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
  );

// List view
router.get(
  '/news',
  (req: Request, res: Response, next: NextFunction) => {
    res.render('news/news', {
      title: 'News',
      username: req.session.user?.username,
      lang: res.locals.lang,
      t: res.locals.t,
      newsList,
    });
  }
);

// Detail view
router.get(
  '/news/:slug',
  (req: Request, res: Response, next: NextFunction) => {
    const item = newsList.find((n) => n.slug === req.params.slug);
    if (!item) return res.redirect('/news');

    res.render('news/news-detail', {
      title: item.title,
      username: req.session.user?.username,
      lang: res.locals.lang,
      t: res.locals.t,
      newsItem: item,
    });
  }
);

export default router;
