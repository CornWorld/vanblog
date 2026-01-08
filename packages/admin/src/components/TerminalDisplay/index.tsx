import convert from 'ansi-to-html';
import DOMPurify from 'dompurify';

const ansiToHtml = new convert();

// DOMPurify configuration for TerminalDisplay
// Allows only ANSI-generated HTML while blocking XSS vectors
const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['span', 'br'],
  ALLOWED_ATTR: ['style'],
  KEEP_CONTENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false,
  SANITIZE_DOM: true,
  FORCE_BODY: false,
};

export default function ({ content }: { content: string }) {
  // Handle null/undefined input gracefully
  const safeContent = content || '';

  // Convert ANSI to HTML
  const html = safeContent
    .split('\n')
    .map((s) => ansiToHtml.toHtml(s))
    .join('<br/>');

  // Sanitize HTML with DOMPurify to prevent XSS attacks
  const cleanHtml = DOMPurify.sanitize(html, SANITIZE_CONFIG);

  return (
    <code
      dangerouslySetInnerHTML={{
        __html: cleanHtml,
      }}
    />
  );
}
