import { useRef } from 'react';
import type { PageProps } from '../types';
import { Console } from './future/Console';
import { FocusList, type FocusItem } from './future/FocusList';
import './future/future.css';
import { Journey } from './future/Journey';

/**
 * The proposal, explained.
 *
 * Two designs came before this one and both failed the same way. The first was
 * a ribbed sculpture, the second a heat-mapped brain rotating on a survey grid,
 * and each was full of invented statistics set a foot tall. They looked
 * expensive. But a reader who scrolled the whole page could not say what had
 * been built, which for a page whose only job is to explain a proposal is a
 * total failure however good it looks. The feedback was exactly that: nothing
 * is really explained here.
 *
 * So this version inverts the ratio. The mechanism comes first and the mood is
 * whatever is left over. Five sections, each answering one question a sceptical
 * reader actually has, in the order they would ask them:
 *
 *   what is it · how does it work · what does it record · is it safe · what is
 *   real today · what would it look like
 *
 * Two changes carry most of that weight. The hero is a diagram of the mechanism
 * rather than a picture of the metaphor — a form losing people, and a counter
 * going up. And the four steps are a focus list, revealing one explanation at a
 * time, because four explanations shown at once are four things to skim and
 * none to read.
 *
 * **The honesty machinery is now structural rather than bolted on.** The old
 * page carried four warning labels because it was mostly invented figures. This
 * one has a whole section — "What is real today" — whose job is to separate the
 * running code from the proposal, and it names files. The invented numbers that
 * remain are confined to the hero diagram and the console, and both say so on
 * themselves. That is a better guarantee than a banner, because it survives
 * somebody screenshotting one section.
 *
 * The facts in "What it records" and "Why it cannot identify anybody" are read
 * off `Backend/app/signals.py` and are true of the running build. If that file
 * changes, this page is wrong and should be corrected with it.
 */

/** The mechanism, one step at a time. */
const STEPS: FocusItem[] = [
  {
    tag: 'Step one',
    title: 'Watch',
    body: 'Somebody presses back on stage four. Somebody edits an answer they already gave. Somebody sits on one question for four minutes and then closes the tab. The service can see all of that happening, and today it throws every bit of it away.',
  },
  {
    tag: 'Step two',
    title: 'Store',
    body: 'Each one is kept as a count against a step and a field. Which step, which field, how long — and nothing else. Keeping it is what makes a comparison possible at all: without a record of last week, this week is not high or low, it is just a number.',
  },
  {
    tag: 'Step three',
    title: 'Group',
    body: 'Forty-seven people failing the same field this afternoon is one problem, not forty-seven. Grouping is what turns a pile of individual bad days into a defect with an address — stage four, address proof — that somebody can be handed.',
  },
  {
    tag: 'Step four',
    title: 'Fix',
    body: 'The field gets rewritten, the hint gets clearer, the validation stops rejecting a valid address. Nobody filed a complaint and nobody had to. That is the whole proposal: the service finds its own faults and repairs them before they reach anybody’s desk.',
  },
];

/** The eight kinds `signals.record` will accept today, and what each means. */
const KINDS: [string, string][] = [
  ['test.wrong', 'A practice question answered wrongly. Records the competency and the scenario, so a whole cohort failing on roundabouts is visible as a curriculum problem.'],
  ['form.unparsed', 'An answer the service could not read. Records the field and the reason — never the words, because “I was born the year my brother finished school” is unreadable and is also somebody’s family.'],
  ['form.reasked', 'The same question asked twice. The clearest single sign that a step is failing.'],
  ['form.abandoned', 'A form left unfinished, and the field it stalled on.'],
  ['form.offtrack', 'A reply that wandered away from the form and was discarded.'],
  ['slot.lost', 'The slot race, from the losing side. Records the office and the day, which is where the next inspector should go.'],
  ['tool.error', 'An action the service tried and could not complete.'],
  ['model.failed', 'A language-model call that failed, and how.'],
];

export function Future({ go }: PageProps) {
  const console_ = useRef<HTMLDivElement>(null);

  return (
    <div className="gb">
      <div className="gb-bar">
        <span className="gb-word">Government brain</span>
        <span className="gb-spacer" />
        <button className="gb-back" onClick={() => go('learning')}>The real counts</button>
        <button className="gb-back" onClick={() => go('home')}>Back to the service</button>
      </div>

      <header className="gb-hero">
        <div className="gb-hero-copy">
          <h1 className="gb-title">
            A government service that notices it is failing you{' '}
            <em>before you complain</em>.
          </h1>
          <p className="gb-lede">
            Every day, people give up halfway through this form. Almost none of them
            report it, so nobody at the department ever finds out. This is a proposal
            for a service that keeps track of where it loses people, and fixes those
            steps on its own.
          </p>
          <button
            className="gb-pill"
            onClick={() => console_.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            See what it would look like
            <span aria-hidden="true">→</span>
          </button>
        </div>

        {/* The mechanism, not the metaphor. */}
        <Journey />
      </header>

      <section className="gb-sec">
        <span className="gb-label">What it is</span>
        <div>
          <p className="gb-claim">
            A service that <em>remembers how it was used</em>, and treats its own
            failures as bugs rather than as complaints.
          </p>
          <p className="gb-body">
            A government service normally learns something is broken when enough people
            complain about it. That takes months, and it only ever surfaces the problems
            people are angry enough to write in about. Everything else — the quiet
            confusion, the abandoned form, the person who assumed they were not
            eligible — leaves no trace at all.
          </p>
          <p className="gb-body">
            The proposal is small and mechanical. <strong>Record where the journey goes
            wrong. Count it. Group the ones that are the same problem. Fix that step.</strong>{' '}
            No complaint is needed at any point, because the failure was already
            visible to the service at the moment it happened.
          </p>
        </div>
      </section>

      <section className="gb-sec">
        <span className="gb-label">How it works</span>
        <div>
          <p className="gb-claim">Four steps, and none of them involve a form to fill in.</p>
          <FocusList items={STEPS} />
        </div>
      </section>

      <section className="gb-sec">
        <span className="gb-label">What it records</span>
        <div>
          <p className="gb-claim">
            Eight kinds of failure, and <em>this part is already running</em>.
          </p>
          <table className="gb-kinds">
            <caption>
              These are the eight signal kinds the build accepts today, taken from the
              service’s own source. Anything not on this list is dropped without being
              written.
            </caption>
            <thead>
              <tr>
                <th scope="col">Signal</th>
                <th scope="col">What it means</th>
              </tr>
            </thead>
            <tbody>
              {KINDS.map(([kind, meaning]) => (
                <tr key={kind}>
                  <th scope="row">{kind}</th>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="gb-sec">
        <span className="gb-label">Why it is safe</span>
        <div>
          <p className="gb-claim">
            It cannot identify anybody, and that is a <em>property, not a promise</em>.
          </p>
          <p className="gb-body">
            <strong>The reference is a keyed hash, not a plain one.</strong> An Indian
            mobile number is ten digits starting six to nine — about four billion
            possibilities, which a laptop exhausts in seconds. A plain digest of a phone
            number is therefore reversible by anyone holding the table, and is not
            anonymisation at all. Each row instead carries an HMAC computed with a secret
            that lives only in the server’s environment. Asking whether the same person
            failed twice still works. Asking who they were does not.
          </p>
          <p className="gb-body">
            <strong>The detail is allowlisted, not filtered.</strong> Each kind of signal
            declares the exact fields it may record, and anything else is discarded
            silently. A filter has to anticipate what to strip out, and the thing that
            eventually leaks is always the field nobody thought of. This way a caller that
            tries to attach a transcript writes nothing at all.
          </p>
          <p className="gb-body">
            <strong>There is no link to any citizen record, and there never will be.</strong>{' '}
            Session-replay tools record the screen, which on a licence form means
            recording somebody’s Aadhaar number. This records that stage four lost
            somebody, and nothing whatsoever about who.
          </p>
        </div>
      </section>

      <section className="gb-sec">
        <span className="gb-label">What is real</span>
        <div>
          <p className="gb-claim">Half of this exists. The other half is the pitch.</p>
          <div className="gb-split">
            <div>
              <h3>Built and running on this site</h3>
              <ul>
                <li>The eight signal kinds above, recorded as the prototype is used.</li>
                <li>The keyed reference and the per-kind allowlist, with tests that prove a stray field is dropped.</li>
                <li>A page of the real counts, at “The real counts” in the bar above.</li>
              </ul>
            </div>
            <div>
              <h3>Proposed, and not built</h3>
              <ul>
                <li>Memory. It can report what is happening now, but not that today differs from last week — which is the comparison the whole idea rests on.</li>
                <li>Grouping failures into one defect with an owner.</li>
                <li>The console below, and every number in it.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div ref={console_}>
        <Console />
      </div>

      <section className="gb-close">
        <span className="gb-label">Before you quote any of it</span>
        <h2>This is a prototype.</h2>
        <p className="gb-body">
          The console above and the counter in the hero are invented, and are there to
          show the shape of what the service would say rather than anything it has said.
          Nothing on this page touches a government system or a real applicant. The
          recording half is genuinely built and running here; the memory that would let
          it notice a change is not. The counts on the next page are the real ones.
        </p>
        <div className="gb-acts">
          <button className="gb-act" onClick={() => go('learning')}>See the real counts</button>
          <button className="gb-act is-quiet" onClick={() => go('proof')}>See the guarantees run</button>
          <button className="gb-act is-quiet" onClick={() => go('home')}>Back to the service</button>
        </div>
      </section>
    </div>
  );
}
