import type { Route } from '../types';

export type FooterTarget = { go: Route } | { info: string } | { help: true } | { grievance: true };
export type FooterLink = [label: string, target: FooterTarget];
export type FooterColumn = [heading: string, links: FooterLink[]];

// Footer link targets: either a route jump, or a panel of real content.
export const FOOTER_COLUMNS: FooterColumn[] = [
  ["Learner's licence", [['Check eligibility', { go: 'elig' }], ['Apply', { go: 'checklist' }], ['Practice test', { go: 'learn' }], ['Book a slot', { go: 'slot' }], ['Road safety tutorial', { go: 'tutorial' }]]],
  // DL journey parked: the two links that opened the wizard are gone; the two
  // that open reference panels stay, because that content is real. Titled as
  // reference, not as a service — a column headed "Driving licence" under a
  // learner's-only home page reads as a second journey that is not there.
  ['Driving licence · reference', [['Driving test tracks', { info: 'tracks' }], ['Fees', { info: 'fees' }]]],
  ['Help', [['How a document is verified', { info: 'verify' }], ['What each fee pays for', { info: 'fees' }], ['Report a problem', { grievance: true }], ['Call 1800 000 000', { help: true }]]],
  ['About this build', [['Problem and approach', { info: 'problem' }], ['What is mocked', { info: 'mocked' }],
    // The staff view and the runnable guarantees. Part of the argument rather
    // than developer tooling, but the top bar had no room left for them.
    ['Inspector desk', { go: 'desk' }], ['See the guarantees run', { go: 'proof' }],
    ['Accessibility', { info: 'a11y' }], ['Source', { info: 'source' }]]],
];

export interface InfoPanel {
  t: string;
  body: [heading: string, rows: [string, string][], paragraph?: string][];
}

export const INFO_PANELS: Record<string, InfoPanel> = {
  fees: {
    t: 'What each fee pays for', body: [
      ["Learner's licence — ₹200 per class", [['Grant of learner\'s licence (Form 3)', '₹150'], ["Learner's licence test fee", '₹50']],
        'Charged once per class of vehicle. Two classes on one application means ₹400, but still one test sitting and one visit. A failed test costs the ₹50 again on rebooking, not the whole ₹200.'],
      ['Driving licence — ₹500 per class', [['Grant of driving licence, including the smart card', '₹200'], ['Driving test fee', '₹300']],
        'The smart card is included in the ₹200. A retest is another ₹300.'],
      ['What is never charged', [],
        'There is no service charge, no portal charge, no facilitation fee and no agent fee. If somebody at an office asks for money outside these lines, it is not a fee.'],
    ],
  },
  verify: {
    t: 'How a document is verified', body: [
      ['The route decides everything', [], 'If you authenticate with Aadhaar, your name, date of birth and address arrive from an existing government record. Nothing is retyped, so nothing can mismatch. Without Aadhaar you type the details and upload a scan, which a clerk compares by eye — that is why the manual route usually adds a verification visit.'],
      ['What is checked instantly here', [], 'File size and format, whether your face is fully inside the frame, whether the signature runs off the paper, and whether the name on the proof matches what the application says. All four are things the counter would otherwise send you home for.'],
      ['What a real build would need behind it', [], 'A consent-based e-KYC integration, an audit log the applicant can read, revocable consent, and a document store that keeps a signed reference rather than a copy of your Aadhaar.'],
    ],
  },
  tracks: {
    t: 'Driving test tracks', body: [
      ['What an automated track tests', [], 'Reversing in an S or figure-of-eight, a gradient start, lane discipline and a controlled stop. Sensors log the run, which removes most of the argument about a fail.'],
      ['You bring the vehicle', [], 'The RTO does not provide one. It must be of the class you are testing for and carry valid registration, insurance and a PUC certificate. This is the single most common reason a booked driving test is wasted.'],
      ['If you do not own one', [], 'Driving schools at each track rent a vehicle with an instructor for the test slot. A real build would list which schools operate at your chosen track and what they charge, so the cost is known before you book.'],
    ],
  },
  problem: {
    t: 'Problem and approach', body: [
      ['Who faces it', [], 'First-time applicants, usually 16 to 25, applying without help. The people who struggle most are the ones doing it alone on a phone, on a slow connection, with no idea what the next screen will ask for.'],
      ['What is hard today', [], 'The stages are scattered across separate menu items reached with an application number. Nothing tells you the total cost up front, nothing explains what a document is for, a booked slot does not behave like an appointment, and a rejection arrives without a reason you can act on.'],
      ['What changed', [], 'Same stages, same forms, same order — so the process behind it is untouched. One decision per screen. Fetch instead of retype. Every fee named with its rule. Validation at the moment of capture rather than at the counter. Slots that publish real remaining capacity.'],
      ['Why it is better', [], 'The failure modes that cost a wasted trip — a bad photo, a name mismatch, a missing receipt, a class you forgot to add — are caught on the screen where they are created.'],
    ],
  },
  mocked: {
    t: 'What is mocked', body: [
      ['Works end to end', [], "Eligibility check, the nine-stage learner's licence application with per-step validation, fee calculation, slot booking, the practice game with its adaptive report card, the tracker, the driving-licence upgrade wizard, and filing a grievance against an application."],
      ['Mocked', [], 'Every OTP, the Aadhaar e-KYC fetch, the payment gateway, all document uploads, RTO capacity numbers, and the licence itself. No real Aadhaar, PAN, payment or personal data is used anywhere, and no government system is contacted.'],
      ['Designed but not built', [], 'The practical-test track levels of the practice game — the automated-track hazards described under "Driving test tracks" are not yet a playable module.'],
      ['Known limits', [], "Maharashtra and Bihar are the only states with real data behind them. Fees follow the central schedule and would need a per-state table. The practice bank is twenty-nine situations, not the full official question bank. The driving-licence wizard skips its own 30-day waiting period on request, since a demo can't wait a month."],
    ],
  },
  a11y: {
    t: 'Accessibility', body: [
      ['Built in', [], 'Text size control and a light/dark theme in the header. A language switcher (English, Hindi, Marathi). Every tap target at least 44px. Visible focus rings on every control. Colour never carries meaning alone — a state always has a label or an icon too. Contrast checked against WCAG AA. Practice-game hearts and round outcomes are announced to screen readers, not just shown visually, and its sound cues can be muted.'],
      ['For low digital literacy', [], 'One decision per screen, plain language instead of statute, no jargon without an explanation next to it, and the practice game readable aloud by the browser.'],
      ['Still missing', [], 'A screen-reader pass beyond the basics above — landmark regions and skip links have not been added. The DL wizard and the report card coaching text are still English-only.'],
    ],
  },
  source: {
    t: 'Source and honesty', body: [
      ['Status', [], 'A design prototype, not a government product. No official emblem or logo is used, and nothing here implies approval or partnership.'],
      ['Data', [], 'All names, numbers, documents, receipts and licences are synthetic. The road-rule content is written from the Motor Vehicles Act, the Central Motor Vehicles Rules and published state question banks.'],
      ['Not done', [], 'No live government system was accessed, tested or interfered with. No private API was reverse-engineered. No personal or restricted data was scraped.'],
    ],
  },
};
