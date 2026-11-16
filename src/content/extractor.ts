import { Readability } from '@mozilla/readability';
import type { PageContent } from '../types/messages';

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function extractPageContent(): PageContent {
  const url = document.location.href;

  try {
    const docClone = document.cloneNode(true) as Document;
    const article = new Readability(docClone).parse();

    if (article?.textContent && article.textContent.trim().length > 0) {
      return {
        title: article.title || document.title,
        text: cleanText(article.textContent),
        excerpt: article.excerpt || '',
        url,
        method: 'readability',
      };
    }
  } catch {
    // fall through to fallback
  }

  return {
    title: document.title,
    text: cleanText(document.body.innerText),
    excerpt: '',
    url,
    method: 'fallback',
  };
}
