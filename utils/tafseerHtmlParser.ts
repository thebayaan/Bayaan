export type TafseerNodeType =
  | 'heading'
  | 'paragraph'
  | 'text'
  | 'narrator'
  | 'hadith'
  | 'quran-quote'
  | 'reference';

export interface TafseerNode {
  type: TafseerNodeType;
  text: string;
  children?: TafseerNode[];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function classifySpan(className: string): TafseerNodeType {
  if (className.includes('blue')) return 'narrator';
  if (className.includes('red')) return 'hadith';
  if (className.includes('arabic') || className.includes('qpc-hafs'))
    return 'quran-quote';
  if (className.includes('brown') || className.includes('reference'))
    return 'reference';
  return 'text';
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

function parseInlineContent(html: string): TafseerNode[] {
  const nodes: TafseerNode[] = [];
  const spanRegex = /<span\s+class="([^"]*)">([\s\S]*?)<\/span>/g;
  let lastIndex = 0;
  let match;

  while ((match = spanRegex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const text = decodeEntities(
        stripTags(html.slice(lastIndex, match.index)).trim(),
      );
      if (text) nodes.push({type: 'text', text});
    }

    const className = match[1];
    const content = decodeEntities(stripTags(match[2]));
    if (content.trim()) {
      nodes.push({type: classifySpan(className), text: content});
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    const text = decodeEntities(stripTags(html.slice(lastIndex)).trim());
    if (text) nodes.push({type: 'text', text});
  }

  return nodes;
}

export function parseTafseerHtml(html: string): TafseerNode[] {
  if (!html || !html.trim()) return [];

  const nodes: TafseerNode[] = [];
  const blockRegex = /<(h2|p)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(html)) !== null) {
    // Text between block tags
    if (match.index > lastIndex) {
      const between = stripTags(html.slice(lastIndex, match.index)).trim();
      if (between) {
        const inlineNodes = parseInlineContent(
          html.slice(lastIndex, match.index),
        );
        if (inlineNodes.length > 0) {
          nodes.push({type: 'paragraph', text: '', children: inlineNodes});
        }
      }
    }

    const tag = match[1];
    const content = match[2];

    if (tag === 'h2') {
      const text = decodeEntities(stripTags(content).trim());
      if (text) nodes.push({type: 'heading', text});
    } else {
      const children = parseInlineContent(content);
      if (children.length > 0) {
        nodes.push({type: 'paragraph', text: '', children});
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // No block tags found — treat entire content as a single paragraph
  if (nodes.length === 0 && html.trim()) {
    const children = parseInlineContent(html);
    if (children.length > 0) {
      nodes.push({type: 'paragraph', text: '', children});
    } else {
      const text = decodeEntities(stripTags(html).trim());
      if (text) {
        nodes.push({
          type: 'paragraph',
          text: '',
          children: [{type: 'text', text}],
        });
      }
    }
    return nodes;
  }

  // Remaining text after last block tag
  if (lastIndex > 0 && lastIndex < html.length) {
    const remaining = decodeEntities(stripTags(html.slice(lastIndex)).trim());
    if (remaining) {
      nodes.push({
        type: 'paragraph',
        text: '',
        children: [{type: 'text', text: remaining}],
      });
    }
  }

  return nodes;
}
