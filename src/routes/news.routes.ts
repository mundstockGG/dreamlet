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
const mdDir = path.join(process.cwd(), 'public', 'markdown', 'entry');


function getAllMarkdownFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllMarkdownFiles(filePath));
    } else if (file.endsWith('.md')) {
      results.push(filePath);
    }
  });
  return results;
}

const newsList: NewsItem[] = getAllMarkdownFiles(mdDir)
  .map((filePath) => {
    const filename = path.relative(mdDir, filePath);
    const slug = filename.replace(/\.md$/, '').replace(/\\/g, '/');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
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
