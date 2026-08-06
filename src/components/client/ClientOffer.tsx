// The offer, as the client reads it.
//
// ONE RENDERING, TWO PLACES. It is the page behind the share link, and it is
// what the operator presents live in the Zoom runner. There is deliberately no
// second "presentation" version: a client who is shown one thing on the call and
// sent another afterwards notices.
//
// EVERY STRING HERE REACHES A CLIENT. Held to the same bar as the deliverables:
// no lead-generation language (no ads, no ranking, no "more leads" — we recover
// demand that already exists), no promise to build or rebuild a website, owner
// vocabulary (calls, jobs, booked work), no hype.
//
// SELF-CONTAINED PALETTE. Every rule below is scoped to `.lgp` and every token it
// reads is declared on `.lgp` itself, so the operator's dark theme cannot reach
// inside it — not on the public page, and not when it renders inside the dark
// call cockpit. scripts/verify-theme.ts asserts both.

// Next does not need this import; the offline verifier does. tsconfig sets
// jsx:"preserve", so scripts/verify-phase4.ts renders this component through
// tsx's classic JSX transform, which calls React.createElement by name. Without
// it the money-law checks fail with "React is not defined" — they render the
// REAL component rather than a copy of it, and that is the point of them.
import React from "react";
import { cad, cadRange, type ComputedRow } from "@/lib/leak-calculator";
import type { ClientOffer as Offer, OfferLink } from "@/lib/client-offer";

const CSS = `
.lgp {
  --bg:#FBFAF7; --surface:#FFFFFF; --surface-2:#F4F2EC; --ink:#1A1814;
  --ink-muted:#6B6659; --accent:#9A7B3F; --accent-tint:#F2ECDD; --border:#E7E3D8;
  --good:#3F7D5A; --critical:#A8443B;
  --heading:'Source Serif 4',Georgia,'Times New Roman',serif;
  background:var(--bg); color:var(--ink); padding:36px 28px 64px;
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  font-size:15.5px; line-height:1.65; -webkit-font-smoothing:antialiased;
  font-variant-numeric:tabular-nums;
}
.lgp * { box-sizing:border-box; }
.lgp h1,.lgp h2,.lgp h3 { font-family:var(--heading); margin:0; }
.lgp p { margin:0 0 12px; max-width:68ch; }
.lgp p:last-child { margin-bottom:0; }
.lgp strong { color:var(--ink); font-weight:600; }

.lgp .lgp-head {
  background:var(--surface); border:1px solid var(--border); border-top:3px solid var(--accent);
  border-radius:4px; padding:34px 32px 26px; margin-bottom:22px;
}
.lgp .lgp-eyebrow {
  font-family:var(--heading); text-transform:uppercase; letter-spacing:.24em;
  font-size:11px; color:var(--accent); margin-bottom:12px; font-weight:700;
}
.lgp .lgp-title { font-size:32px; line-height:1.14; letter-spacing:-.015em; font-weight:700; max-width:24ch; }
.lgp .lgp-sub { font-size:14px; color:var(--ink-muted); margin-top:12px; }

.lgp .lgp-sec { background:var(--surface); border:1px solid var(--border); border-radius:4px; padding:26px 30px; margin-bottom:16px; }
.lgp .lgp-sec-head { display:flex; align-items:baseline; gap:12px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--border); flex-wrap:wrap; }
.lgp .lgp-sec-n { font-family:var(--heading); font-size:12px; font-weight:700; color:var(--accent); background:var(--accent-tint); padding:4px 9px; border-radius:6px; line-height:1; }
.lgp .lgp-sec h2 { font-size:21px; letter-spacing:-.015em; font-weight:700; line-height:1.2; }
.lgp .lgp-note { font-size:13px; color:var(--ink-muted); margin-top:10px; }

.lgp .lgp-row { border:1px solid var(--border); border-left:3px solid var(--critical); border-radius:0 6px 6px 0; padding:14px 16px; margin-bottom:10px; background:var(--surface); }
.lgp .lgp-row-head { display:flex; justify-content:space-between; align-items:baseline; gap:14px; flex-wrap:wrap; margin-bottom:5px; }
.lgp .lgp-row-t { font-family:var(--heading); font-weight:700; font-size:16px; letter-spacing:-.01em; }
.lgp .lgp-cost { font-family:var(--heading); font-weight:700; font-size:15px; color:var(--critical); white-space:nowrap; }
.lgp .lgp-said { font-size:13.5px; color:var(--ink-muted); margin:0 0 4px; }
.lgp .lgp-row p { font-size:14px; margin:0; }
.lgp .lgp-tag { display:inline-block; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-muted); border:1px solid var(--border); background:var(--surface-2); border-radius:99px; padding:2px 8px; margin-left:8px; vertical-align:middle; }

.lgp .lgp-clean { border:1px solid var(--border); border-left:3px solid var(--good); border-radius:0 6px 6px 0; padding:12px 16px; margin-bottom:8px; background:var(--surface); }
.lgp .lgp-clean-t { font-family:var(--heading); font-weight:700; font-size:15px; }
.lgp .lgp-clean-v { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--good); }

.lgp .lgp-total { border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:0 6px 6px 0; background:var(--accent-tint); padding:20px 24px; }
.lgp .lgp-total-k { font-family:var(--heading); font-size:10.5px; text-transform:uppercase; letter-spacing:.14em; font-weight:700; color:var(--ink-muted); margin-bottom:5px; }
.lgp .lgp-total-v { font-family:var(--heading); font-size:30px; font-weight:700; letter-spacing:-.02em; color:var(--accent); line-height:1.1; }
.lgp .lgp-total-a { font-size:13.5px; color:var(--ink-muted); margin-top:8px; }
.lgp .lgp-basis { font-size:13px; color:var(--ink-muted); margin-top:14px; padding-top:12px; border-top:1px solid var(--border); }

.lgp .lgp-build { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr)); gap:10px; }
.lgp .lgp-item { border:1px solid var(--border); border-radius:6px; padding:13px 15px; background:var(--surface); }
.lgp .lgp-item-t { font-family:var(--heading); font-weight:700; font-size:14.5px; letter-spacing:-.01em; margin-bottom:4px; }
.lgp .lgp-item p { font-size:13px; color:var(--ink-muted); margin:0; }
.lgp .lgp-item.is-out { background:var(--surface-2); border-style:dashed; }
.lgp .lgp-why { font-size:12px; font-weight:600; color:var(--ink-muted); margin-top:6px; }
.lgp .lgp-why strong { color:var(--ink-muted); }

.lgp .lgp-prices { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr)); gap:14px; }
.lgp .lgp-price { border:1px solid var(--border); border-radius:6px; padding:20px 22px; background:var(--surface); position:relative; overflow:hidden; }
.lgp .lgp-price::before { content:""; position:absolute; top:0; left:0; right:0; height:3px; background:var(--accent); }
.lgp .lgp-price-k { font-family:var(--heading); font-size:11px; text-transform:uppercase; letter-spacing:.1em; font-weight:700; color:var(--ink-muted); margin-bottom:7px; }
.lgp .lgp-price-v { font-family:var(--heading); font-size:31px; font-weight:700; letter-spacing:-.03em; color:var(--ink); line-height:1.1; margin-bottom:8px; }
.lgp .lgp-cad { font-family:'Inter',sans-serif; font-size:13px; font-weight:600; color:var(--ink-muted); letter-spacing:0; }
.lgp .lgp-price-d { font-size:13px; color:var(--ink-muted); margin:0; }

.lgp .lgp-close { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr)); gap:12px; margin-top:4px; }
.lgp .lgp-btn { display:block; text-align:center; text-decoration:none; border-radius:6px; padding:17px 20px; font-size:15.5px; font-weight:700; border:1px solid var(--accent); background:var(--accent); color:var(--surface); font-family:var(--heading); letter-spacing:-.01em; }
.lgp .lgp-btn.is-second { background:var(--surface); color:var(--accent); }
.lgp .lgp-btn-todo { display:block; text-align:center; border-radius:6px; padding:14px 18px; border:2px dashed var(--critical); background:var(--surface); color:var(--critical); font-weight:700; font-size:14px; }
.lgp .lgp-btn-todo span { display:block; font-family:'Inter',sans-serif; font-weight:600; font-size:11.5px; letter-spacing:.04em; margin-top:5px; }

.lgp .lgp-foot { font-size:12.5px; color:var(--ink-muted); margin-top:18px; text-align:center; }
`;

export function ClientOffer({ offer }: { offer: Offer }) {
  const { business } = offer;
  const where = [business.industry, business.city].filter(Boolean).join(" · ");

  // The all-clean page has one section where the priced page has two, so the
  // later numbers shift. Written out rather than counted at render time: four
  // literals are readable, and a counter threaded through child components
  // renumbers itself if React ever reorders them.
  const priced = !offer.allClean;
  const nBuild = priced ? "03" : "02";
  const nInvest = priced ? "04" : "03";

  return (
    <div className="lgp">
      {/* dangerouslySetInnerHTML, not {CSS}, and it is not optional.
          As a child, React escapes the stylesheet's quotes server-side
          (&#x27;Source Serif 4&#x27;) and leaves them raw on the client, so the
          two renders disagree, hydration fails and React throws away the server
          HTML and repaints the entire document. On a page a client opens on a
          phone that is a visible flash of unstyled content. The content is our
          own constant above — no user input reaches it. */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="lgp-head">
        <div className="lgp-eyebrow">Conversion recovery</div>
        <h1 className="lgp-title">{business.name}</h1>
        <div className="lgp-sub">
          {where ? `${where} — ` : ""}what we found, what we build, and what it costs.
        </div>
      </header>

      {priced ? <Leaks offer={offer} /> : <AllClean />}

      <Build offer={offer} n={nBuild} />
      <Investment offer={offer} n={nInvest} />
      <Close offer={offer} />

      <p className="lgp-foot">Prepared by ReclaimedHQ. Figures are estimates, not guarantees.</p>
    </div>
  );
}

// ── What's leaking ───────────────────────────────────────────────────────────

function Leaks({ offer }: { offer: Offer }) {
  return (
    <>
      <section className="lgp-sec">
        <div className="lgp-sec-head">
          <span className="lgp-sec-n">01</span>
          <h2>What&apos;s leaking</h2>
        </div>

        {offer.leakRows.map((row) => (
          <LeakRow key={row.id} row={row} />
        ))}

        {offer.cleanRows.length > 0 && (
          <>
            <p className="lgp-note">
              These areas came back covered. Nothing is priced against them.
            </p>
            {offer.cleanRows.map((row) => (
              <div key={row.id} className="lgp-clean">
                <div className="lgp-row-head">
                  <span className="lgp-clean-t">{row.label}</span>
                  <span className="lgp-clean-v">No leak</span>
                </div>
                <p className="lgp-said">{row.answerText}</p>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="lgp-sec">
        <div className="lgp-sec-head">
          <span className="lgp-sec-n">02</span>
          <h2>What that adds up to</h2>
        </div>
        <div className="lgp-total">
          <div className="lgp-total-k">Estimated monthly recoverable</div>
          <div className="lgp-total-v">{cadRange(offer.totalLow, offer.totalHigh)}</div>
          <div className="lgp-total-a">
            {cadRange(offer.annualLow, offer.annualHigh)} across a year
            {offer.capped ? " · conservatively capped" : ""}
          </div>
        </div>
        <p className="lgp-basis">{offer.derivation}</p>
      </section>
    </>
  );
}

function LeakRow({ row }: { row: ComputedRow }) {
  const low = row.monthlyLow ?? 0;
  const high = row.monthlyHigh ?? 0;
  return (
    <div className="lgp-row">
      <div className="lgp-row-head">
        <span className="lgp-row-t">
          {row.label}
          {row.assumed && <span className="lgp-tag">Assumed</span>}
        </span>
        <span className="lgp-cost">{cadRange(low, high)}/mo</span>
      </div>
      {row.answerText && <p className="lgp-said">You said: {row.answerText}</p>}
      {row.consequence && <p>{row.consequence}</p>}
    </div>
  );
}

// The genuinely-clean outcome. NOT an error state and not an empty state: they
// answered every question and every answer was good. Saying so plainly is worth
// more than padding the page with a leak we did not find.
function AllClean() {
  return (
    <section className="lgp-sec">
      <div className="lgp-sec-head">
        <span className="lgp-sec-n">01</span>
        <h2>What&apos;s leaking</h2>
      </div>
      <div className="lgp-clean">
        <div className="lgp-clean-v">No leak found</div>
      </div>
      <p style={{ marginTop: 12 }}>
        Every area we asked about came back covered — after-hours, missed calls, response
        speed, quote follow-up, no-shows, and past customers. On these questions there is
        nothing leaking, so nothing here is priced.
      </p>
      <p>
        The build below still applies: it makes the coverage you already have run
        automatically rather than depending on somebody being free.
      </p>
    </section>
  );
}

// ── The build ────────────────────────────────────────────────────────────────

function Build({ offer, n }: { offer: Offer; n: string }) {
  return (
    <section className="lgp-sec">
      <div className="lgp-sec-head">
        <span className="lgp-sec-n">{n}</span>
        <h2>What we install</h2>
      </div>
      <p className="lgp-note">
        {offer.installedCount} automations, built inside your own account and handed over
        working. Everything below is included in the one-time build.
      </p>
      <div className="lgp-build">
        {offer.installed.map((w) => (
          <div key={w.id} className="lgp-item">
            <div className="lgp-item-t">{w.name}</div>
            <p>{w.whatItDoes}</p>
          </div>
        ))}
      </div>

      {/* Every omission is named with its reason. A list of what we skipped, with
          no reason beside it, reads as something we forgot. */}
      {offer.omitted.length > 0 && (
        <>
          <p className="lgp-note" style={{ marginTop: 20 }}>
            Not installed for you, and why:
          </p>
          <div className="lgp-build">
            {offer.omitted.map((w) => (
              <div key={w.id} className="lgp-item is-out">
                <div className="lgp-item-t">{w.name}</div>
                <div className="lgp-why">{w.omittedBecause}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ── The investment ───────────────────────────────────────────────────────────

function Investment({ offer, n }: { offer: Offer; n: string }) {
  return (
    <section className="lgp-sec">
      <div className="lgp-sec-head">
        <span className="lgp-sec-n">{n}</span>
        <h2>The investment</h2>
      </div>
      <div className="lgp-prices">
        <div className="lgp-price">
          <div className="lgp-price-k">One-time build</div>
          <div className="lgp-price-v">{cad(offer.setupFeeCad)}</div>
          <p className="lgp-price-d">
            Everything above, built and tested in your account, plus the pipeline, the
            booking calendar and page, the enquiry form, and your dedicated number. Live in
            about two weeks.
          </p>
        </div>
        <div className="lgp-price">
          <div className="lgp-price-k">Monthly</div>
          <div className="lgp-price-v">
            {cad(offer.monthlyRetainerCad)} <span className="lgp-cad">/ month</span>
          </div>
          <p className="lgp-price-d">
            Every new enquiry qualified before it reaches you, the system run and tuned as
            your business changes, and a report each month showing what it caught.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Sign, then pay ───────────────────────────────────────────────────────────

function Close({ offer }: { offer: Offer }) {
  return (
    <section className="lgp-sec">
      <div className="lgp-sec-head">
        <h2>Ready to start</h2>
      </div>
      <p className="lgp-note" style={{ marginBottom: 14 }}>
        Sign the agreement first, then the payment link opens the build. Kickoff is the
        same week.
      </p>
      <div className="lgp-close">
        <CloseButton link={offer.agreement} />
        <CloseButton link={offer.payment} second />
      </div>
    </section>
  );
}

/** A configured link renders as a button. An unconfigured one renders as a loud,
 *  unmissable placeholder naming the variable to set — never as a blank button
 *  and never as a button that goes nowhere, because a client only has to be let
 *  down by one of those once. */
function CloseButton({ link, second }: { link: OfferLink; second?: boolean }) {
  if (!link.href) {
    return (
      <div className="lgp-btn-todo">
        {link.label} — LINK NOT SET
        <span>Set {link.missingEnvVar} to enable this button</span>
      </div>
    );
  }
  return (
    <a
      className={second ? "lgp-btn is-second" : "lgp-btn"}
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {link.label}
    </a>
  );
}
