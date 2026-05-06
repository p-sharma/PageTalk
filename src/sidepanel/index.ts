import { CreateMLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import type { MLCEngine } from '@mlc-ai/web-llm';
import type { PageContent } from '../types/messages';

const MODEL_ID = 'Phi-3.5-mini-instruct-q4f16_1-MV';
const MAX_CONTEXT_WORDS = 3000;
const MAX_HISTORY_TURNS = 10;

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

let engine: MLCEngine | null = null;
let pageContext: PageContent | null = null;
let history: Message[] = [];
let isGenerating = false;

function truncateText(text: string): string {
  const words = text.split(/\s+/);
  if (words.length <= MAX_CONTEXT_WORDS) return text;
  return words.slice(0, MAX_CONTEXT_WORDS).join(' ') + '\n\n[Content truncated]';
}

function buildSystemPrompt(page: PageContent): string {
  return `You are a helpful, casual assistant that helps people understand web pages. Answer questions like a knowledgeable friend — conversational, brief, and in your own words. Don't quote the page verbatim. For vague questions like "what is this?" or "what's this about?", give a quick friendly summary.

Page the user is viewing:
Title: ${page.title}
URL: ${page.url}

${truncateText(page.text)}`;
}

function renderUnsupported(): void {
  document.getElementById('app')!.innerHTML = `
    <div class="error-box">
      <strong>WebGPU not supported</strong>
      <p>PageTalk requires WebGPU for local inference. Use Chrome 113+ or Edge 113+ with a compatible GPU.</p>
    </div>
  `;
}

function renderError(message: string): void {
  document.getElementById('app')!.innerHTML = `
    <div class="error-box">
      <strong>Initialization failed</strong>
      <p>${message}</p>
    </div>
  `;
}

function renderLoading(progress: number, text: string): void {
  const app = document.getElementById('app')!;

  if (!document.getElementById('loading-state')) {
    app.innerHTML = `
      <div id="loading-state">
        <p class="loading-label">Loading model&hellip;</p>
        <div class="progress-track">
          <div id="progress-fill" class="progress-fill"></div>
        </div>
        <p id="progress-text" class="progress-text"></p>
      </div>
    `;
  }

  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('progress-text');
  if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
  if (label) label.textContent = text;
}

function renderChat(): void {
  document.getElementById('app')!.innerHTML = `
    <div id="messages"></div>
    <div id="input-area">
      <textarea id="user-input" rows="3" placeholder="Ask about this page…"></textarea>
      <button id="send-btn">Send</button>
    </div>
  `;

  document.getElementById('send-btn')!.addEventListener('click', handleSend);
  (document.getElementById('user-input') as HTMLTextAreaElement).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}

function setSendEnabled(enabled: boolean): void {
  const btn = document.getElementById('send-btn') as HTMLButtonElement | null;
  if (btn) btn.disabled = !enabled;
}

function scrollToBottom(): void {
  const messages = document.getElementById('messages');
  if (messages) messages.scrollTop = messages.scrollHeight;
}

function addMessage(role: 'user' | 'assistant', text: string): HTMLElement {
  const messages = document.getElementById('messages')!;
  const div = document.createElement('div');
  div.className = `message message-${role}`;
  div.textContent = text;
  messages.appendChild(div);
  scrollToBottom();
  return div;
}

async function fetchPageContent(): Promise<PageContent | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' }, (response) => {
      if (chrome.runtime.lastError || response?.type !== 'PAGE_CONTENT_RESULT') {
        resolve(null);
        return;
      }
      resolve(response.payload as PageContent);
    });
  });
}

async function handleSend(): Promise<void> {
  if (isGenerating || !engine) return;

  const input = document.getElementById('user-input') as HTMLTextAreaElement;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  isGenerating = true;
  setSendEnabled(false);
  addMessage('user', text);

  if (pageContext === null) {
    pageContext = await fetchPageContent();
  }

  const systemPrompt = pageContext
    ? buildSystemPrompt(pageContext)
    : 'You are a helpful, casual assistant. Answer conversationally and briefly.';

  history.push({ role: 'user', content: text });

  const contextWindow = history.slice(-(MAX_HISTORY_TURNS * 2));
  const assistantBubble = addMessage('assistant', '…');

  try {
    const stream = await engine.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, ...contextWindow],
      stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      fullResponse += delta;
      assistantBubble.textContent = fullResponse || '…';
      scrollToBottom();
    }

    history.push({ role: 'assistant', content: fullResponse });
  } catch {
    assistantBubble.textContent = 'Something went wrong. Please try again.';
    history.pop();
  } finally {
    isGenerating = false;
    setSendEnabled(true);
    (document.getElementById('user-input') as HTMLTextAreaElement)?.focus();
  }
}

async function init(): Promise<void> {
  if (!('gpu' in navigator)) {
    renderUnsupported();
    return;
  }

  renderLoading(0, 'Starting…');

  try {
    engine = await CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report: InitProgressReport) => {
        renderLoading(report.progress, report.text);
      },
    });
    renderChat();
  } catch (err) {
    renderError(err instanceof Error ? err.message : String(err));
  }
}

init();
