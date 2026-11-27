import type { ReactNode } from 'react';
import { Clock3, Database } from 'lucide-react';
import type { ChatFact } from '@/lib/api/copilot';

type MessageBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'code'; text: string };

function parseBlocks(content: string): MessageBlock[] {
  const lines = content.replace(/\r/g, '').split('\n');
  const blocks: MessageBlock[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }

    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1] });
      index += 1;
      continue;
    }

    const boldHeading = line.match(/^\*\*(.+)\*\*$/);
    if (boldHeading) {
      blocks.push({ type: 'heading', text: boldHeading[1] });
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(lines[index])) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, '').trim());
        index += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,3}\s+/.test(lines[index].trim()) &&
      !/^\*\*.+\*\*$/.test(lines[index].trim()) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith('```')
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}

function inlineContent(text: string): ReactNode[] {
  const tokens = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*)/g;
  const nodes: ReactNode[] = [];
  let start = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokens.exec(text))) {
    if (match.index > start) nodes.push(text.slice(start, match.index));
    const token = match[0];
    if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key++} className="font-semibold text-[#20231f] dark:text-white">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key++} className="rounded bg-black/[0.05] px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/10">{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    start = tokens.lastIndex;
  }

  if (start < text.length) nodes.push(text.slice(start));
  return nodes;
}

export function ChatMessageContent({ content }: { content: string }) {
  return (
    <div className="space-y-2 break-words [overflow-wrap:anywhere]">
      {parseBlocks(content).map((block, index) => {
        if (block.type === 'heading') {
          return <h3 key={index} className="text-sm font-bold leading-snug text-[#20231f] dark:text-white">{inlineContent(block.text)}</h3>;
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className="space-y-1.5 pl-1">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-700 dark:bg-emerald-400" />
                  <span>{inlineContent(item)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'code') {
          return <pre key={index} className="overflow-x-auto rounded-lg bg-[#20231f] p-3 text-xs leading-relaxed text-white"><code>{block.text}</code></pre>;
        }
        return <p key={index} className="leading-relaxed">{inlineContent(block.text)}</p>;
      })}
    </div>
  );
}

const sourceNames: Record<string, string> = {
  getSalesSummary: 'Sales invoices & payments',
  getTopProducts: 'Product sales',
  getInventoryStatus: 'Stock balances',
  getOutstandingInvoices: 'Outstanding invoices',
  getExpenseSummary: 'Expense records',
  getPurchaseOrders: 'Purchase orders',
  getBusinessInsights: 'Business insights',
  getStockoutPredictions: 'Stock forecasts',
  getDemandForecast: 'Demand forecast',
  getCashflowForecast: 'Cash flow forecast',
  getChurnRisks: 'Customer activity',
};

export function AssistantResponse({
  answer,
  facts = [],
  sources = [],
  dataPeriod,
  followUps = [],
  onFollowUp,
}: {
  answer: string;
  facts?: ChatFact[];
  sources?: string[];
  dataPeriod?: string;
  followUps?: string[];
  onFollowUp: (question: string) => void;
}) {
  const sourceLabels = [...new Set(sources.map((source) => sourceNames[source] || source))];
  const visibleFacts = facts.slice(0, 4);

  return (
    <div className="space-y-3">
      {visibleFacts.length > 0 && (
        <div className={`grid gap-2 ${visibleFacts.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`} aria-label="Key figures">
          {visibleFacts.map((fact) => (
            <div key={fact.label} className="min-w-0 rounded-xl border border-emerald-100 bg-white/80 px-3 py-2 dark:border-emerald-900/40 dark:bg-white/[0.04]">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-[#687064] dark:text-white/55">{fact.label}</p>
              <p className="mt-1 break-words text-base font-bold tabular-nums text-emerald-900 dark:text-emerald-200">{fact.value}</p>
            </div>
          ))}
        </div>
      )}

      <ChatMessageContent content={answer} />

      {(sourceLabels.length > 0 || dataPeriod) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[#e6e9e2] pt-2 text-[10px] text-[#687064] dark:border-white/10 dark:text-white/55">
          {sourceLabels.length > 0 && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Database size={12} className="shrink-0 text-emerald-700 dark:text-emerald-300" />
              <span className="truncate">{sourceLabels.join(', ')}</span>
            </span>
          )}
          {dataPeriod && (
            <span className="inline-flex items-center gap-1">
              <Clock3 size={12} className="shrink-0" />
              {dataPeriod}
            </span>
          )}
        </div>
      )}

      {followUps.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#687064] dark:text-white/55">Continue with</p>
          <div className="flex flex-wrap gap-1.5">
            {followUps.slice(0, 3).map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => onFollowUp(question)}
                className="rounded-full border border-emerald-200 bg-white px-2.5 py-1.5 text-left text-[10px] font-semibold leading-snug text-emerald-900 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 dark:border-white/15 dark:bg-white/[0.04] dark:text-emerald-200 dark:hover:bg-white/10"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
