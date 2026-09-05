import type { ApplicationStep, AppState, Category, Route, StageDefinition, StageRow } from '../types';

export const STATES = ['Maharashtra', 'Bihar', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'Gujarat', 'West Bengal', 'Kerala', 'Rajasthan', 'Telangana'];

/**
 * State names in Devanagari.
 *
 * A proper noun usually stays in Latin here — a person's name, a street — but a
 * state is not that kind of proper noun on an Indian government form: every
 * Hindi form prints महाराष्ट्र, and this build's own copy already did, so the
 * picker was showing "Maharashtra" in a tile sitting directly above a sentence
 * that said महाराष्ट्र.
 *
 * Keyed on the English name because that is what is stored on the application
 * and sent to the service; only the label changes.
 */
export const STATE_HI: Record<string, string> = {
  Maharashtra: 'महाराष्ट्र', Bihar: 'बिहार', Delhi: 'दिल्ली', Karnataka: 'कर्नाटक',
  'Tamil Nadu': 'तमिलनाडु', 'Uttar Pradesh': 'उत्तर प्रदेश', Gujarat: 'गुजरात',
  'West Bengal': 'पश्चिम बंगाल', Kerala: 'केरल', Rajasthan: 'राजस्थान', Telangana: 'तेलंगाना',
};

export const CATEGORIES: Category[] = [
  { id: 'none', t: 'I do not hold any licence', tHi: 'मेरे पास कोई लाइसेंस नहीं है', tMr: 'माझ्याकडे कोणतेही लायसन्स नाही',
    d: "First learner's licence. Most people are here.", dHi: 'पहला लर्नर लाइसेंस। ज़्यादातर लोग यहीं हैं।', dMr: 'पहिले लर्नर लायसन्स. बहुतेक लोक येथेच आहेत.' },
  { id: 'hold', t: 'I already hold a licence', tHi: 'मेरे पास पहले से एक लाइसेंस है', tMr: 'माझ्याकडे आधीच एक लायसन्स आहे',
    d: 'You will be asked for the number and date of birth.', dHi: 'आपसे नंबर और जन्म तिथि पूछी जाएगी।', dMr: 'तुम्हाला नंबर आणि जन्मतारीख विचारली जाईल.' },
  { id: 'defence', t: 'I hold a defence licence', tHi: 'मेरे पास एक रक्षा लाइसेंस है', tMr: 'माझ्याकडे एक संरक्षण लायसन्स आहे',
    d: 'Service licence being converted to a civil one.', dHi: 'सेवा लाइसेंस को नागरिक लाइसेंस में बदला जा रहा है।', dMr: 'सेवा लायसन्सचे नागरी लायसन्समध्ये रूपांतर केले जात आहे.' },
];

// Stage order mirrors the real Sarathi journey. What changes is how each stage behaves:
// one decision per screen, fetch instead of retype, and every fee named before it is charged.
// Deliberately dropped: the captcha (an accessibility barrier that stops no bot worth stopping)
// and the four separate payment menu items, collapsed into one confirmed state.
export const STEPS: ApplicationStep[] = [
  { t: 'State and RTO', tHi: 'राज्य और आरटीओ', tMr: 'राज्य आणि आरटीओ', ref: 'Sarathi: state selection → Learner Licence menu' },
  { t: 'Who is applying', tHi: 'कौन आवेदन कर रहा है', tMr: 'कोण अर्ज करत आहे', ref: 'Sarathi: Select Category + Authentication screen' },
  { t: 'Identity check', tHi: 'पहचान जांच', tMr: 'ओळख पडताळणी', ref: 'Sarathi: Authentication With E-KYC' },
  { t: 'Confirm what came back', tHi: 'प्राप्त विवरण की पुष्टि करें', tMr: 'मिळालेल्या तपशीलांची पुष्टी करा', ref: 'Sarathi: Applicant Details / Address Details → Proceed' },
  { t: 'About you', tHi: 'आपके बारे में', tMr: 'तुमच्याबद्दल', ref: 'Form 2 — Application for LL, General' },
  { t: 'Address', tHi: 'पता', tMr: 'पत्ता', ref: 'Form 2 — Address block' },
  { t: 'Classes of vehicle', tHi: 'वाहन श्रेणी', tMr: 'वाहन श्रेणी', ref: 'Form 2 — Select Class of Vehicles tab' },
  { t: 'Form 1 declaration', tHi: 'फॉर्म 1 घोषणा', tMr: 'फॉर्म 1 घोषणा', ref: 'Self-Declaration (Form 1), See Rule 5(2)' },
  { t: 'Documents, photo, signature', tHi: 'दस्तावेज़, फोटो, हस्ताक्षर', tMr: 'कागदपत्रे, फोटो, स्वाक्षरी', ref: 'Sarathi: three separate upload menus' },
  { t: 'Review and submit', tHi: 'समीक्षा करें और जमा करें', tMr: 'पुनरावलोकन करा आणि सादर करा', ref: 'Sarathi: Submit → Application Reference Slip' },
];

// Post-submission stages. The real portal reaches each of these from a separate menu item
// with your application number; here they are one tracked sequence with exemptions shown.
// Photo, e-sign and the form itself are prerequisites of submission, so any submitted
// application has them completed. Only fee, verify and test remain.
export const STAGES: StageDefinition[] = [
  { n: 'Fill application details LL', nHi: 'LL आवेदन विवरण भरें', nMr: 'LL अर्जाचे तपशील भरा', k: 'fill' },
  { n: 'Upload documents', nHi: 'दस्तावेज़ अपलोड करें', nMr: 'कागदपत्रे अपलोड करा', k: 'docs' },
  { n: 'Upload photo and signature', nHi: 'फोटो और हस्ताक्षर अपलोड करें', nMr: 'फोटो आणि स्वाक्षरी अपलोड करा', k: 'photo' },
  { n: 'E-sign document', nHi: 'ई-हस्ताक्षर दस्तावेज़', nMr: 'ई-स्वाक्षरी कागदपत्र', k: 'esign' },
  { n: 'Fee payment', nHi: 'शुल्क भुगतान', nMr: 'फी भरणा', k: 'fee' },
  { n: 'Verify the payment status', nHi: 'भुगतान की स्थिति सत्यापित करें', nMr: 'भरण्याची स्थिती पडताळा', k: 'verify' },
  // Parked, not deleted. The learner's test is taken online, so there is no
  // learner's appointment to book — the booking moved to the driving test, a
  // month later, at #/dl. Seven stages now.
  // { n: 'LL slot book', nHi: 'LL स्लॉट बुक करें', nMr: 'LL स्लॉट बुक करा', k: 'slot' },
  { n: 'Take the LL test', nHi: 'LL परीक्षा दें', nMr: 'LL परीक्षा द्या', k: 'test' },
];

const STAGE_RANK: Record<string, number> = { submitted: 0, esign: 0, paid: 1, booked: 2, issued: 3 };

/** Derives per-stage status (Completed / Exempted / To be done) from the app's current stage and route. */
export function stageState(state: AppState): StageRow[] {
  const isAadhaar = state.form?.route === 'aadhaar';
  const rank = STAGE_RANK[state.stage || 'submitted'] ?? 0;
  // `booked` still occupies rank 2 and is still written — by the receipt, to
  // mean "past the fee" rather than "holds an appointment". The test needs rank
  // 3, so both `paid` and `booked` leave it outstanding, which is what the
  // resume gate reads.
  const isDone = (key: string) => ({ fill: true, docs: true, photo: true, esign: true, fee: rank >= 1, verify: rank >= 1, test: rank >= 3 } as Record<string, boolean>)[key];
  return STAGES.map(stage => {
    // The slot half of this is gone with the stage: nobody books a learner's
    // appointment now, so there is nothing for an Aadhaar applicant to be
    // exempt from.
    if (isAadhaar && stage.k === 'docs') return { ...stage, status: 'Exempted' };
    if (isDone(stage.k)) return { ...stage, status: 'Completed' };
    return { ...stage, status: 'To be done by you' };
  });
}

/**
 * The stage a citizen still has to do, and the screen where they do it.
 *
 * Lives here rather than in the stage table that first needed it, because the
 * apply gate asks the same question — "what does this person still owe?" — and
 * two answers to it would drift apart the first time a stage moved. `fill`,
 * `docs`, `photo` and `esign` have no entry: submission is their prerequisite,
 * so they can never be the outstanding one.
 */
export const NEXT_STAGE_ROUTE: Record<string, Route> = { fee: 'pay', verify: 'pay', test: 'tutorial' };

/** The first stage still to be done, or undefined when the journey is finished. */
export function nextStage(state: AppState): StageRow | undefined {
  return stageState(state).find(row => row.status === 'To be done by you');
}
