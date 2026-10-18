import Icon from './Icon.jsx';
import { Section } from './Status.jsx';

// The four questions every pitch must answer, stated before any number.
export default function DecisionSection({ ctx }) {
  const items = [
    {
      icon: 'person',
      q: 'Who is the user?',
      a: `${ctx.stateLabel}'s state drought program administrator, who runs an emergency farm relief fund.`,
    },
    {
      icon: 'gavel',
      q: 'What do they decide?',
      a: `Which counties get the $${ctx.budgetM}M first, and the score that triggers it. They decide in mid-August, months before harvest surveys come out.`,
    },
    {
      icon: 'dataset',
      q: 'What evidence?',
      a: 'Heat days, weeks in severe drought, drought severity, rainfall and soil water storage, all known by August. Built from 26 seasons of USDA, NOAA, Drought Monitor and soil survey data.',
    },
    {
      icon: 'verified',
      q: 'How do we know it works?',
      a: 'The rules were set on 2000–2015 and then tested blind on 2016–2025, against the counties whose harvests actually collapsed.',
      link: '#proof',
    },
  ];

  return (
    <Section
      id="decision"
      step="1"
      title="The decision"
      takeaway={`Relief is only useful if it comes early. Which ${ctx.stateLabel} ${ctx.crop.toLowerCase()} counties should get emergency drought money first?`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {items.map((it) => (
          <div key={it.q} className="bg-surface-container-high/70 rounded-xl p-space-md">
            <div className="flex items-center gap-2 font-eyebrow text-eyebrow uppercase text-primary-fixed">
              <Icon name={it.icon} className="text-[18px] text-accent-neon" />
              {it.q}
            </div>
            <p className="font-body-md text-body-md text-on-surface mt-2">{it.a}</p>
            {it.link && (
              <a href={it.link} className="inline-block mt-2 font-label-code text-label-code text-accent-neon hover:underline">
                See the test results ↓
              </a>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
