/**
 * The curated prose is written in markdown — 467 caveats and 84 purposes contain `**bold**` or
 * backtick code. Rendered as plain text it reads as broken formatting. Only two inline forms are
 * supported on purpose: no dependency, no `dangerouslySetInnerHTML`, and nothing here can inject
 * markup. Shared by the server page and the inline editor (pure, no directive needed).
 */
export function Prose({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
          return (
            <code key={i} className="bg-bauhaus-canvas px-1 font-mono text-[0.92em]">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
