import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { Section } from './Status.jsx';
import { postJson } from '../lib/api.js';

// Human-readable label for each tool the assistant can call (see src/advisor.py).
const TOOL_LABELS = {
  rank_counties: (i) => `Ranked ${i.state} ${i.crop?.toLowerCase()} ${i.year}`,
  county_details: (i) => `Report card: ${i.county} (${i.state} ${i.crop?.toLowerCase()}, ${i.year ?? 2020})`,
  validation_results: (i) => `Blind test: ${i.state} ${i.crop?.toLowerCase()}`,
  what_drives_losses: (i) => `Correlations: ${i.state} ${i.crop?.toLowerCase()}`,
  data_coverage: () => 'Data coverage table',
};

export default function AdvisorView({ ctx, messages, setMessages, topCounty }) {
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const endRef = useRef(null);

  // Block body on purpose: newer browsers return a Promise from scrollIntoView, and an effect must not return one.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending]);

  const suggestions = [
    `Which ${ctx.stateLabel} counties get relief in ${ctx.year}, and why?`,
    topCounty && `Why did ${topCounty.county_name} score ${topCounty.urgency_score.toFixed(1)}?`,
    'How does the model compare with rainfall alone on unseen years?',
    'Which county lost the most in 2020 but got no drought relief?',
    'How much water does a single farm field near Ames hold?', // tests the "data can't answer" path
  ].filter(Boolean);

  const ask = async (question) => {
    const q = question.trim();
    if (!q || pending) return;
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setPending(true);
    try {
      const res = await postJson('chat', {
        question: q,
        history,
        context: { state: ctx.stateCode, crop: ctx.crop, year: ctx.year, budget_m: ctx.budgetM, quota_pct: ctx.quotaPct },
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.answer, tools: res.tools_used }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: err.message, error: true, setup: err.body?.setup }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <Section
      id="ask"
      step="AI"
      title="Ask the data"
      takeaway="Ask a question in plain English. Every number in the answer comes from the same model as this dashboard."
      right={
        messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-bright font-label-code text-label-code flex items-center gap-1"
          >
            <Icon name="refresh" className="text-[16px]" />
            New conversation
          </button>
        )
      }
    >
      <div className="bg-surface-container/90 rounded-xl shadow-xl flex flex-col">
        <div className="p-space-md lg:p-space-lg space-y-space-md min-h-[320px] max-h-[60vh] overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-center py-space-lg">
              <Icon name="smart_toy" className="text-[40px] text-accent-neon" />
              <p className="font-body-md text-body-md text-on-surface mt-2">
                Ask about any county, season, or the blind test. Questions use the current settings ({ctx.stateLabel}, {ctx.crop.toLowerCase()},{' '}
                {ctx.year}, ${ctx.budgetM}M, top {ctx.quotaPct}%) unless you say otherwise.
              </p>
              <p className="font-body-sm text-body-sm text-text-muted mt-1">
                If the data can't answer something (single fields, irrigation, other states, after 2025), it will say so.
              </p>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-2xl bg-secondary-container text-on-surface rounded-xl rounded-tr-none px-4 py-2.5 font-body-md text-body-md">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                  <Icon name={m.error ? 'error' : 'smart_toy'} className={`text-[18px] ${m.error ? 'text-error' : 'text-accent-neon'}`} />
                </div>
                <div
                  className={`max-w-3xl rounded-xl rounded-tl-none px-4 py-3 border ${
                    m.error ? 'bg-error-container/20 border-error/40' : 'bg-surface-container-high/80 border-surface-container-highest'
                  }`}
                >
                  <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  {m.setup && (
                    <pre className="mt-2 p-2 rounded bg-surface-container-lowest font-label-code text-[12px] text-on-surface whitespace-pre-wrap">
                      {'# in the repo root\necho "ANTHROPIC_API_KEY=sk-ant-..." > .env\npython api_server.py'}
                    </pre>
                  )}
                  {m.tools?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-surface-container-highest flex flex-wrap gap-1.5 items-center">
                      <span className="font-micro text-micro uppercase text-text-muted">Looked up:</span>
                      {m.tools.map((t, j) => (
                        <span key={j} className="px-2 py-0.5 rounded bg-surface-container-lowest font-label-code text-[11px] text-primary-fixed">
                          {(TOOL_LABELS[t.tool] ?? (() => t.tool))(t.input)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {pending && (
            <div className="flex items-center gap-2 font-label-code text-label-code text-text-muted">
              <span className="w-2 h-2 rounded-full bg-accent-neon animate-ping" />
              Checking the data…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-surface-container-highest p-space-md space-y-space-sm">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                disabled={pending}
                onClick={() => ask(s)}
                className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high border border-surface-container-highest font-body-sm text-body-sm text-on-surface disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              className="flex-1 bg-surface-container-lowest border border-surface-container-highest rounded-lg px-3 py-2 text-on-surface placeholder:text-text-muted font-body-md text-body-md focus:outline-none focus:ring-1 focus:ring-accent-neon"
              placeholder="e.g. Which Nebraska counties would get relief in 2012?"
              maxLength={1000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={pending}
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-body-sm font-bold hover:bg-accent-hover disabled:opacity-50"
            >
              <Icon name="send" className="text-[18px]" />
              Ask
            </button>
          </form>
          <p className="font-micro text-micro text-text-muted">
            Answers are generated by Claude using lookups into our model. Check important figures against the dashboard pages.
          </p>
        </div>
      </div>
    </Section>
  );
}
