'use client';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

/** Parse markdown-style links into clickable elements */
function parseContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const linkRegex = /\[([^\]]+)\]\((\/(?:grants|foundations)\/[a-zA-Z0-9-]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    // Text before the link
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const [, linkText, href] = match;
    const isGrant = href.startsWith('/grants/');

    parts.push(
      <a
        key={match.index}
        href={href}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-black border-2 transition-all hover:-translate-y-0.5 ${
          isGrant
            ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white'
            : 'border-money bg-money-light text-money hover:bg-money hover:text-white'
        }`}
      >
        <span className="uppercase tracking-wider">{isGrant ? 'Grant' : 'Foundation'}</span>
        <span className="font-bold normal-case tracking-normal">{linkText}</span>
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/** Render bold text */
function renderFormatted(text: string): React.ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**')) {
      return <strong key={i}>{seg.slice(2, -2)}</strong>;
    }
    return <span key={i}>{parseContent(seg)}</span>;
  });
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`p-3 border-4 ${
      isUser
        ? 'bg-bauhaus-canvas border-bauhaus-black'
        : 'bg-white border-bauhaus-blue'
    }`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1.5">
        {isUser ? 'You' : 'GrantScope AI'}
      </div>
      <div className="text-sm leading-relaxed font-medium text-bauhaus-black whitespace-pre-wrap">
        {renderFormatted(content)}
      </div>
    </div>
  );
}
