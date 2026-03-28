'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import {
  Bold,
  Italic,
  Heading,
  Link,
  Image,
  Quote,
  Code,
  List,
  ListOrdered,
  Minus,
  Maximize2,
  Minimize2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean; // true = operates on whole line(s)
}

// ---------------------------------------------------------------------------
// Simple Markdown -> HTML converter (client-side, no deps)
// ---------------------------------------------------------------------------

function markdownToHtml(md: string): string {
  let html = md;

  // Fenced code blocks (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="bg-gray-100 rounded p-3 overflow-x-auto text-sm"><code>${escapeHtml(code.trimEnd())}</code></pre>`;
  });

  // Blockquotes (lines starting with >)
  html = html.replace(/^(?:>\s?(.*)(?:\n|$))+/gm, (match) => {
    const inner = match
      .split('\n')
      .map((l) => l.replace(/^>\s?/, ''))
      .join('\n');
    return `<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600">${inner}</blockquote>\n`;
  });

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6 class="text-sm font-bold mt-4 mb-1">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="text-sm font-bold mt-4 mb-1">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 class="text-base font-bold mt-4 mb-1">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="my-4 border-gray-300" />');

  // Unordered lists
  html = html.replace(/^(?:[-*]\s+.+(?:\n|$))+/gm, (match) => {
    const items = match
      .trim()
      .split('\n')
      .map((l) => `<li>${l.replace(/^[-*]\s+/, '')}</li>`)
      .join('');
    return `<ul class="list-disc list-inside my-2">${items}</ul>\n`;
  });

  // Ordered lists
  html = html.replace(/^(?:\d+\.\s+.+(?:\n|$))+/gm, (match) => {
    const items = match
      .trim()
      .split('\n')
      .map((l) => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`)
      .join('');
    return `<ol class="list-decimal list-inside my-2">${items}</ol>\n`;
  });

  // Images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded my-2" />');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">$1</a>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Paragraphs: convert double newlines to paragraph breaks
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Don't wrap blocks that already start with an HTML tag
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr|img|div)/.test(trimmed)) {
        return trimmed;
      }
      return `<p class="my-2 leading-relaxed">${trimmed.replace(/\n/g, '<br />')}</p>`;
    })
    .join('\n');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCAL_STORAGE_KEY = 'markdown-editor-draft';
const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '# 見出し\n\n本文をMarkdownで記述...',
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved'>('saved');
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const draftRef = useRef<string | null>(null);
  const lastSavedRef = useRef(value);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -----------------------------------------------------------------------
  // Word / character counts
  // -----------------------------------------------------------------------
  const charCount = value.length;
  const wordCount = value.trim() === '' ? 0 : value.trim().split(/\s+/).length;

  // -----------------------------------------------------------------------
  // Restore draft on mount
  // -----------------------------------------------------------------------
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved && saved !== value && saved.trim() !== '') {
        draftRef.current = saved;
        setShowRestorePrompt(true);
      }
    } catch {
      // localStorage unavailable
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRestore = (accept: boolean) => {
    if (accept && draftRef.current) {
      onChange(draftRef.current);
    }
    draftRef.current = null;
    setShowRestorePrompt(false);
  };

  // -----------------------------------------------------------------------
  // Auto-save to localStorage with debounce
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (value !== lastSavedRef.current) {
      setSaveStatus('unsaved');
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, value);
        lastSavedRef.current = value;
        setSaveStatus('saved');
      } catch {
        // quota exceeded or unavailable
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [value]);

  // -----------------------------------------------------------------------
  // Toolbar actions
  // -----------------------------------------------------------------------
  const toolbarActions: ToolbarAction[] = [
    { icon: <Bold size={16} />, label: 'Bold', prefix: '**', suffix: '**' },
    { icon: <Italic size={16} />, label: 'Italic', prefix: '*', suffix: '*' },
    { icon: <Heading size={16} />, label: 'Heading', prefix: '## ', suffix: '', block: true },
    { icon: <Link size={16} />, label: 'Link', prefix: '[', suffix: '](url)' },
    { icon: <Image size={16} />, label: 'Image', prefix: '![alt](', suffix: ')' },
    { icon: <Quote size={16} />, label: 'Quote', prefix: '> ', suffix: '', block: true },
    { icon: <Code size={16} />, label: 'Code', prefix: '`', suffix: '`' },
    { icon: <ListOrdered size={16} />, label: 'Ordered list', prefix: '1. ', suffix: '', block: true },
    { icon: <List size={16} />, label: 'Unordered list', prefix: '- ', suffix: '', block: true },
    { icon: <Minus size={16} />, label: 'Horizontal rule', prefix: '\n---\n', suffix: '', block: true },
  ];

  const insertAtCursor = useCallback(
    (prefix: string, suffix: string) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = value.slice(start, end);
      const replacement = `${prefix}${selected || 'text'}${suffix}`;
      const newValue = value.slice(0, start) + replacement + value.slice(end);

      onChange(newValue);

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.focus();
        const cursorPos = start + prefix.length;
        const cursorEnd = cursorPos + (selected || 'text').length;
        ta.setSelectionRange(cursorPos, cursorEnd);
      });
    },
    [value, onChange],
  );

  const handleToolbarClick = useCallback(
    (action: ToolbarAction) => {
      insertAtCursor(action.prefix, action.suffix);
    },
    [insertAtCursor],
  );

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === 'b') {
        e.preventDefault();
        insertAtCursor('**', '**');
      } else if (e.key === 'i') {
        e.preventDefault();
        insertAtCursor('*', '*');
      } else if (e.key === 'k') {
        e.preventDefault();
        insertAtCursor('[', '](url)');
      }
    },
    [insertAtCursor],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-white flex flex-col'
    : 'flex flex-col border border-gray-200 rounded-lg overflow-hidden';

  return (
    <div className={containerClasses}>
      {/* Restore draft prompt */}
      {showRestorePrompt && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-yellow-800">
            以前の下書きが見つかりました。復元しますか？
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleRestore(true)}
              className="px-3 py-1 bg-yellow-500 text-white rounded text-xs font-medium hover:bg-yellow-600 transition-colors"
            >
              復元する
            </button>
            <button
              onClick={() => handleRestore(false)}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300 transition-colors"
            >
              破棄する
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
        {toolbarActions.map((action) => (
          <button
            key={action.label}
            type="button"
            title={action.label}
            onClick={() => handleToolbarClick(action)}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
          >
            {action.icon}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Save status badge */}
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            saveStatus === 'saved'
              ? 'bg-green-100 text-green-700'
              : 'bg-orange-100 text-orange-700'
          }`}
        >
          {saveStatus === 'saved' ? 'Saved' : 'Unsaved changes'}
        </span>

        {/* Word / char count */}
        <span className="text-xs text-gray-400 ml-2">
          {charCount} chars / {wordCount} words
        </span>

        {/* Fullscreen toggle */}
        <button
          type="button"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={() => setIsFullscreen((f) => !f)}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors ml-1"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Split pane: editor + preview */}
      <div className={`flex flex-1 min-h-0 ${isFullscreen ? 'h-full' : 'h-96'}`}>
        {/* Editor pane */}
        <div className="w-1/2 flex flex-col border-r border-gray-200">
          <div className="px-3 py-1 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Editor
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 w-full resize-none p-4 font-mono text-sm leading-relaxed focus:outline-none"
            spellCheck={false}
          />
        </div>

        {/* Preview pane */}
        <div className="w-1/2 flex flex-col">
          <div className="px-3 py-1 bg-gray-50 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Preview
            </span>
          </div>
          <div
            className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }}
          />
        </div>
      </div>
    </div>
  );
}
