export interface PageContent {
  title: string;
  text: string;
  excerpt: string;
  url: string;
  method: 'readability' | 'fallback';
}

export type ExtensionMessage =
  | { type: 'GET_PAGE_CONTENT' }
  | { type: 'PAGE_CONTENT_RESULT'; payload: PageContent }
  | { type: 'PAGE_CONTENT_ERROR'; error: string };
