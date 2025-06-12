import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { html as diff2html } from 'diff2html';
import hljs from 'highlight.js';
import { marked } from 'marked';

const changelogDir = path.join(__dirname, '../../public/markdown/changelog');

export const getChangelog = (req: Request, res: Response) => {
  fs.readdir(changelogDir, (err, files) => {
    if (err) return res.status(500).send('Error reading changelog directory');
    const changelogs = files
      .filter(f => f.endsWith('.md'))
      .map(filename => {
        const filePath = path.join(changelogDir, filename);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(fileContent);
        let htmlContent;
        if (filename.endsWith('.diff.md')) {
          // Check for ```diff code block
        const diffBlockMatch = content.match(/```diff\s*([\s\S]*?)```/i);
          if (diffBlockMatch) {
            // Render as highlighted diff code block
            const code = diffBlockMatch[1].trim();
            const highlighted = hljs.highlight(code, { language: 'diff' }).value;
            htmlContent = `<pre><code class="hljs diff">${highlighted}</code></pre>`;
          } else {
            // Fallback: try to render as unified diff
            htmlContent = `<div class='diff2html-wrapper'>${diff2html(content, { drawFileList: false, matching: 'lines', outputFormat: 'line-by-line' })}</div>`;
          }
        } else {
          // Render as regular markdown
          htmlContent = marked(content);
        }
        // Add footer always outside the diff2html wrapper for visibility
        htmlContent += '<div class="text-end mt-3"><small>by mundstock</small></div>';
        return {
          ...data,
          content: htmlContent,
          date: data.date ? new Date(data.date) : new Date(0),
        };
      })
      .sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime());
    const username = req.session?.user?.username;
    res.render('main/changelog', { changelogs, username, title: 'Changelog' });
  });
};
