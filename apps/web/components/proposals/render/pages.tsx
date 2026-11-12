/* eslint-disable @next/next/no-img-element -- template pictures are remote and printed as-is */
import type { ProposalPageDef, ProposalTemplate } from '@vastu/contracts';
import { Block, headingClass, type BlockCtx } from './blocks';
import { fillTokens } from './tokens';

interface PageProps {
  def: ProposalPageDef;
  template: ProposalTemplate;
  ctx: BlockCtx;
  /** 1-based sheet number and the total, for the footer. */
  n: number;
  of: number;
  /** A pricing table that continues onto another sheet. */
  continued?: boolean;
}

const kicker = 'text-[11px] font-semibold tracking-[0.2em] uppercase';

/** Cover and closing pages share one shell: a picture, a headline and a few facts. */
function Feature({ def, template, ctx, cover }: PageProps & { cover: boolean }) {
  const f = (s: string) => fillTokens(s, ctx.values);
  const h = headingClass(template.theme);
  const headline = def.headline ? f(def.headline) : '';
  const sub = def.subline ? f(def.subline) : '';

  const facts = cover ? (
    <div className="flex flex-wrap gap-x-8 gap-y-3 text-[12px]">
      <div>
        <p className={`${kicker} opacity-70`}>Proposal</p>
        <p className="mt-1 text-[15px] font-semibold whitespace-nowrap">{ctx.doc.number ?? 'Draft'}</p>
      </div>
      <div>
        <p className={`${kicker} opacity-70`}>Date</p>
        <p className="mt-1 text-[15px] font-semibold whitespace-nowrap">{ctx.values['proposal.date']}</p>
      </div>
      {ctx.values['proposal.validUntil'] && (
        <div>
          <p className={`${kicker} opacity-70`}>Valid until</p>
          <p className="mt-1 text-[15px] font-semibold whitespace-nowrap">{ctx.values['proposal.validUntil']}</p>
        </div>
      )}
    </div>
  ) : (
    def.blocks.map((b, i) => <Block key={i} block={b} ctx={ctx} />)
  );

  const logo = (light: boolean) => (
    <img
      src={template.logo}
      alt="Vaastu Kitchen"
      className="h-14 w-auto object-contain"
      style={light ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  );

  if (def.layout === 'minimal' || !def.image) {
    return (
      <div className="flex h-full flex-col justify-between p-[70px]">
        <div className="flex items-center justify-between">
          {logo(false)}
          {cover && <p className={`${kicker} opacity-60`}>Proposal</p>}
        </div>
        <div>
          <div className="mb-6 h-1 w-16" style={{ background: 'var(--t-primary)' }} />
          <h1 className={`${h} text-[54px] leading-[1.05]`}>{headline}</h1>
          {sub && <p className="mt-4 max-w-[520px] text-[18px] opacity-70">{sub}</p>}
        </div>
        <div className="space-y-6">{facts}</div>
      </div>
    );
  }

  if (def.layout === 'split') {
    return (
      <div className="flex h-full">
        <div className="flex w-[52%] flex-col justify-between p-[54px]">
          {logo(false)}
          <div>
            <div className="mb-5 h-1 w-14" style={{ background: 'var(--t-accent)' }} />
            <h1 className={`${h} text-[42px] leading-[1.08]`}>{headline}</h1>
            {sub && <p className="mt-4 text-[16px] opacity-70">{sub}</p>}
          </div>
          <div className="space-y-5">{cover ? facts : <div className="space-y-5">{facts}</div>}</div>
        </div>
        <img src={def.image} alt="" className="h-full w-[48%] object-cover" />
      </div>
    );
  }

  // hero: full-bleed picture, dark wash, text over the bottom.
  return (
    <div className="relative h-full text-white">
      <img src={def.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgb(20 14 10 / .55) 0%, rgb(20 14 10 / .15) 35%, rgb(20 14 10 / .85) 100%)' }}
      />
      <div className="relative flex h-full flex-col justify-between p-[60px]">
        {logo(true)}
        <div className="space-y-6">
          <div className="h-1 w-16" style={{ background: 'var(--t-primary)' }} />
          <h1 className={`${h} max-w-[640px] text-[56px] leading-[1.05]`}>{headline}</h1>
          {sub && <p className="max-w-[560px] text-[19px] opacity-90">{sub}</p>}
          <div className="space-y-4 pt-4">{facts}</div>
        </div>
      </div>
    </div>
  );
}

/** Content, pricing and terms pages: a quiet header, the blocks, a footer with the page number. */
function Interior({ def, template, ctx, n, of, continued }: PageProps) {
  const h = headingClass(template.theme);
  const title = def.title ? fillTokens(def.title, ctx.values) : '';
  return (
    <div className="flex h-full flex-col px-[58px] pt-[46px] pb-[34px]">
      <header className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--t-accent)' }}>
        <img src={template.logo} alt="Vaastu Kitchen" className="h-9 w-auto object-contain" />
        <p className={`${kicker} opacity-60`}>{ctx.doc.number ?? 'Draft'}</p>
      </header>
      {title && (
        <h2 className={`${h} mt-7 text-[34px] leading-none`} style={{ color: 'var(--t-primary)' }}>
          {title}
          {continued ? <span className="text-[16px] opacity-60"> (continued)</span> : null}
        </h2>
      )}
      <div className="mt-6 flex-1 space-y-6 overflow-hidden">
        {def.blocks.map((b, i) => (
          <Block key={i} block={b} ctx={ctx} />
        ))}
      </div>
      <footer className="flex items-center justify-between pt-3 text-[10.5px] opacity-60">
        <span>{ctx.values['company.name']} · vaastukitchen.com</span>
        <span className="tabular">
          {n} / {of}
        </span>
      </footer>
    </div>
  );
}

export function PageView(props: PageProps) {
  const { kind } = props.def;
  if (kind === 'cover') return <Feature {...props} cover />;
  if (kind === 'thankyou') return <Feature {...props} cover={false} />;
  return <Interior {...props} />;
}
