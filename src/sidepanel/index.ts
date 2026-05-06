import { CreateMLCEngine, InitProgressReport } from '@mlc-ai/web-llm';
import type { MLCEngine } from '@mlc-ai/web-llm';
import type { PageContent } from '../types/messages';

const MODEL_ID = 'Phi-3.5-mini-instruct-q4f16_1-MV';
const MAX_CONTEXT_WORDS = 3000;
const MAX_HISTORY_TURNS = 10;

const SPEAKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
const STOP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
const MIC_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

let engine: MLCEngine | null = null;
let pageContext: PageContent | null = null;
let history: Message[] = [];
let isGenerating = false;
const ttsAvailable: boolean = 'speechSynthesis' in window;
let activeTtsBtn: HTMLButtonElement | null = null;

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
    <div id="chat-header">
      <button id="clear-btn">Clear chat</button>
    </div>
    <div id="messages"></div>
    <div id="input-area">
      <textarea id="user-input" rows="3" placeholder="Ask about this page…"></textarea>
      <button id="mic-btn" disabled title="Voice input coming soon">${MIC_SVG}</button>
      <button id="send-btn">Send</button>
    </div>
  `;

  document.getElementById('send-btn')!.addEventListener('click', handleSend);
  document.getElementById('clear-btn')!.addEventListener('click', resetChat);
  (document.getElementById('user-input') as HTMLTextAreaElement).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}

function setSendEnabled(enabled: boolean): void {
  const sendBtn = document.getElementById('send-btn') as HTMLButtonElement | null;
  if (sendBtn) sendBtn.disabled = !enabled;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement | null;
  if (clearBtn) clearBtn.disabled = !enabled;
}

function resetChat(): void {
  if (ttsAvailable) speechSynthesis.cancel();
  if (activeTtsBtn) { activeTtsBtn = null; }
  history = [];
  pageContext = null;
  const messages = document.getElementById('messages');
  if (messages) messages.innerHTML = '';
}

function scrollToBottom(): void {
  const messages = document.getElementById('messages');
  if (messages) messages.scrollTop = messages.scrollHeight;
}

function setTtsBtnState(btn: HTMLButtonElement, state: 'play' | 'stop'): void {
  btn.innerHTML = state === 'play' ? SPEAKER_SVG : STOP_SVG;
  btn.title = state === 'play' ? 'Read aloud' : 'Stop';
  btn.dataset.state = state;
}

function speak(text: string, btn: HTMLButtonElement): void {
  speechSynthesis.cancel();

  if (activeTtsBtn && activeTtsBtn !== btn) {
    setTtsBtnState(activeTtsBtn, 'play');
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  utterance.onend = () => {
    setTtsBtnState(btn, 'play');
    if (activeTtsBtn === btn) activeTtsBtn = null;
  };
  utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
    if (e.error !== 'interrupted') {
      setTtsBtnState(btn, 'play');
      if (activeTtsBtn === btn) activeTtsBtn = null;
    }
  };

  activeTtsBtn = btn;
  setTtsBtnState(btn, 'stop');
  speechSynthesis.speak(utterance);
}

function stopSpeech(btn: HTMLButtonElement): void {
  speechSynthesis.cancel();
  setTtsBtnState(btn, 'play');
  activeTtsBtn = null;
}

function addMessage(role: 'user' | 'assistant', text: string): HTMLElement {
  const messages = document.getElementById('messages')!;
  const div = document.createElement('div');
  div.className = `message message-${role}`;

  if (role === 'assistant') {
    const thinking = document.createElement('span');
    thinking.className = 'thinking-indicator';
    thinking.innerHTML = '<span></span><span></span><span></span>';

    const textSpan = document.createElement('span');
    textSpan.className = 'message-text';

    if (text) {
      textSpan.textContent = text;
      thinking.hidden = true;
    } else {
      textSpan.hidden = true;
    }

    div.appendChild(thinking);
    div.appendChild(textSpan);

    if (ttsAvailable) {
      const btn = document.createElement('button');
      btn.className = 'tts-btn';
      btn.hidden = true;
      setTtsBtnState(btn, 'play');
      btn.addEventListener('click', () => {
        const responseText = textSpan.textContent ?? '';
        if (btn.dataset.state === 'stop') {
          stopSpeech(btn);
        } else {
          speak(responseText, btn);
        }
      });
      div.appendChild(btn);
    }
  } else {
    div.textContent = text;
  }

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
  const assistantBubble = addMessage('assistant', '');
  const textSpan = assistantBubble.querySelector<HTMLSpanElement>('.message-text')!;
  const thinkingDots = assistantBubble.querySelector<HTMLSpanElement>('.thinking-indicator')!;

  try {
    const stream = await engine.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, ...contextWindow],
      stream: true,
    });

    let fullResponse = '';
    let revealed = false;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      fullResponse += delta;
      if (!revealed && fullResponse) {
        thinkingDots.hidden = true;
        textSpan.hidden = false;
        revealed = true;
      }
      textSpan.textContent = fullResponse;
      scrollToBottom();
    }

    history.push({ role: 'assistant', content: fullResponse });

    if (ttsAvailable && fullResponse) {
      const ttsBtn = assistantBubble.querySelector<HTMLButtonElement>('.tts-btn');
      if (ttsBtn) {
        ttsBtn.hidden = false;
        speak(fullResponse, ttsBtn);
      }
    }
  } catch {
    textSpan.textContent = 'Something went wrong. Please try again.';
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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TAB_NAVIGATED') {
    resetChat();
  }
});

init();
