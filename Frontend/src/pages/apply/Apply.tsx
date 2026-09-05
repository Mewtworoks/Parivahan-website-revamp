import { useEffect, useRef, type ComponentType } from 'react';
import * as api from '../../api';
import { PRE_BASE, preFor } from '../../data/applicant';
import { demoForm } from '../../data/demoApplicant';
import { STEPS } from '../../data/applicationFlow';
import { FORM1 } from '../../data/documents';
import { feeTotal } from '../../data/fees';
import { CLASSES } from '../../data/vehicleClasses';
import { signedInPhone } from '../../lib/identity';
import { scrollToTop } from '../../lib/scrollToTop';
import { useT } from '../../lib/language';
import { useAction } from '../../lib/useApi';
import { isValidEmail, isValidMobile, isValidPin } from '../../lib/validate';
import type { ApplicationForm, PageProps } from '../../types';
import { Icon } from '../../ui/Icon';
import { Bar, Note, Pill, Progress, Stepper } from '../../ui/SharedUI';
import {
  AboutYou, AddressDetails, ConfirmEkycDetails, DocumentsPhotoSignature, Form1Declaration,
  IdentityCheck, ReviewAndSubmit, StateAndRto, VehicleClasses, WhoIsApplying, type StepProps,
} from './steps';

const STEP_COMPONENTS: ComponentType<StepProps>[] = [
  StateAndRto, WhoIsApplying, IdentityCheck, ConfirmEkycDetails, AboutYou,
  AddressDetails, VehicleClasses, Form1Declaration, DocumentsPhotoSignature, ReviewAndSubmit,
];

/** One outstanding requirement, in the three languages the site speaks. */
type Requirement = [en: string, hi: string, mr: string];

/**
 * What each step is still waiting for, indexed the same way as STEPS.
 *
 * This used to answer with a boolean, and the only thing that happened to a
 * step that was not ready was that Continue went grey. Nothing said which of
 * ten conditions was outstanding — the Form 1 stage alone wants six
 * declarations, a signature, a medical certificate on some class choices, and
 * two more answers — and an empty required field showed no error either, since
 * every error is gated on the field being both touched *and* non-empty. So the
 * screen's whole answer to "why can't I go on?" was a grey rectangle.
 *
 * An empty list means the step is done. The order is the order they are asked
 * for on the page, so the list reads top to bottom like the form does.
 */
function stepRequirements({ step, form, isAadhaar, classIds, needsMedicalCert, form1Answers }: {
  step: number; form: ApplicationForm; isAadhaar: boolean; classIds: string[]; needsMedicalCert: boolean; form1Answers: Record<string, string>;
}): Requirement[] {
  const out: Requirement[] = [];
  const need = (test: boolean, label: Requirement) => { if (!test) out.push(label); };

  switch (step) {
    case 1:
      need(!!form.cat, ['Whether you already hold a licence', 'क्या आपके पास पहले से लाइसेंस है', 'तुमच्याकडे आधीच लायसन्स आहे का']);
      need(!!form.route, ['Aadhaar or the manual route', 'आधार या मैनुअल रास्ता', 'आधार किंवा मॅन्युअल मार्ग']);
      break;
    case 2:
      if (isAadhaar) need(!!form.kyc, ['Your Aadhaar or VID, and the three consents', 'आपका आधार या VID, और तीनों सहमतियां', 'तुमचा आधार किंवा VID, आणि तिन्ही संमती']);
      else need(!!form.manualOk, ['A verified mobile number', 'एक सत्यापित मोबाइल नंबर', 'एक सत्यापित मोबाइल नंबर']);
      break;
    case 3:
      need(!isAadhaar || !!form.kycOk, ['Confirmation that the fetched details are right', 'पुष्टि कि प्राप्त विवरण सही हैं', 'मिळालेले तपशील बरोबर असल्याची पुष्टी']);
      break;
    case 4:
      need(!!(form.first ?? PRE_BASE.first), ['Your first name', 'आपका पहला नाम', 'तुमचे पहिले नाव']);
      need(isValidEmail((form.email ?? PRE_BASE.email) as string), ['A valid email address', 'एक वैध ईमेल पता', 'एक वैध ईमेल पत्ता']);
      need(isValidMobile(form.phone || ''), ['A ten-digit mobile number', 'दस अंकों का मोबाइल नंबर', 'दहा अंकी मोबाइल नंबर']);
      break;
    case 5:
      need(isValidPin((form.pin ?? preFor(form.state).pin) as string), ['A six-digit PIN code', 'छह अंकों का पिन कोड', 'सहा अंकी पिन कोड']);
      break;
    case 6:
      need(classIds.length > 0, ['At least one class of vehicle', 'कम से कम एक वाहन श्रेणी', 'किमान एक वाहन वर्ग']);
      break;
    case 7:
      need(FORM1.every(([key]) => form1Answers[key]), ['An answer to every Form 1 question', 'फॉर्म 1 के हर सवाल का जवाब', 'फॉर्म 1 च्या प्रत्येक प्रश्नाचे उत्तर']);
      need(!!form.f1sign, ['Your signature on the Form 1 declaration', 'फॉर्म 1 घोषणा पर आपका हस्ताक्षर', 'फॉर्म 1 घोषणेवर तुमची स्वाक्षरी']);
      need(!needsMedicalCert || !!form.form1a, ['Form 1A, the medical certificate your class needs', 'फॉर्म 1A, आपकी श्रेणी के लिए ज़रूरी मेडिकल प्रमाणपत्र', 'फॉर्म 1A, तुमच्या वर्गासाठी आवश्यक वैद्यकीय प्रमाणपत्र']);
      need(form.conv !== undefined, ['Whether you have been disqualified before', 'क्या आपको पहले अयोग्य ठहराया गया है', 'तुम्हाला यापूर्वी अपात्र ठरवले आहे का']);
      need(!!form.organ, ['Your organ-donation answer', 'अंगदान पर आपका जवाब', 'अवयवदानाबाबत तुमचे उत्तर']);
      break;
    case 8:
      need(isAadhaar || form.photo === 'ok', ['An accepted photograph', 'एक स्वीकृत फोटो', 'एक स्वीकृत फोटो']);
      need(form.sign === 'ok', ['An accepted signature', 'एक स्वीकृत हस्ताक्षर', 'एक स्वीकृत स्वाक्षरी']);
      need(!!form.docsOk, ['Both proofs — age and address', 'दोनों प्रमाण — आयु और पता', 'दोन्ही पुरावे — वय आणि पत्ता']);
      break;
    case 9:
      need(!!form.esign, ['Your e-sign on the application', 'आवेदन पर आपका ई-हस्ताक्षर', 'अर्जावर तुमची ई-स्वाक्षरी']);
      need(!!form.captchaOk, ['The verification question', 'सत्यापन प्रश्न', 'पडताळणी प्रश्न']);
      break;
    default:
      break;   // step 0 asks for nothing: the state and office both have a default
  }
  return out;
}

/** The nine-stage learner's-licence application wizard. */
export function Apply({ go, state, update }: PageProps) {
  const t = useT();
  /**
   * The current stage, read from the journey rather than held here.
   *
   * Clamped on the way in and out: a stored index is only as trustworthy as the
   * build that wrote it, and a wizard that has since lost a stage would index
   * STEPS out of bounds and render nothing at all. Clamping turns the worst
   * case into "you resume on the last stage" instead of a blank screen.
   */
  const stepCount = STEPS.length;
  const clampStep = (n: number) => Math.min(Math.max(Math.trunc(n) || 0, 0), stepCount - 1);
  const step = clampStep(state.formStep ?? 0);
  const setStep = (next: number) => update({ formStep: clampStep(next) });
  const { pending, error, run } = useAction();
  // One key for this attempt at submitting. A dropped connection and a second
  // press reuse it, so the server returns the first application instead of
  // creating a duplicate — the failure that produces two live applications on
  // the real portal. Starting the wizard again mints a new one.
  const idempotencyKey = useRef(`ll-web-${Date.now().toString(36)}`).current;
  const form = state.form || {};
  const updateForm = (patch: Partial<ApplicationForm>) => update({ form: { ...form, ...patch } });
  const classIds = form.classes || [];
  const isAadhaar = form.route === 'aadhaar';
  const needsMedicalCert = classIds.some(id => CLASSES.find(c => c.id === id)?.medical);
  const totalFee = feeTotal(classIds, form.state || 'Maharashtra');
  const form1Answers = form.f1 || {};

  const outstanding = stepRequirements({ step, form, isAadhaar, classIds, needsMedicalCert, form1Answers });
  const valid = outstanding.length === 0;

  /**
   * The number the citizen signed in with, put into the form they are filling.
   *
   * This route cannot be reached without signing in, and signing in is done with
   * a mobile number — then stage two asked for it again. The service already
   * had it, files the application under it, and looks the journey up by it; the
   * one place it was not used was the field labelled Mobile number.
   *
   * Seeded into a gap only, so a number typed by hand is never overwritten —
   * somebody filling this in for a relative is entitled to a different one.
   */
  useEffect(() => {
    const signedIn = signedInPhone();
    if (signedIn && !form.phone) updateForm({ phone: signedIn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.phone]);

  /**
   * Fill every stage and jump to the last one.
   *
   * Typing nine screens of details in front of an audience proves nothing the
   * build is arguing — the argument starts at Submit. The state's own office is
   * kept if one is already picked, so this does not silently move the
   * application to Mumbai when the demo is about Bihar.
   */
  const fillForDemo = () => {
    update({ form: { ...demoForm(form.state || 'Maharashtra'), ...(form.rto ? { rto: form.rto } : {}) } });
    setStep(STEPS.length - 1);
    scrollToTop();
  };

  const submit = async () => {
    const name = [form.first ?? PRE_BASE.first, form.last ?? PRE_BASE.last].join(' ');
    const classCodes = classIds.map(id => CLASSES.find(c => c.id === id)!.code);
    const submitted = await run('submit', () => api.apply({
      // The signed-in number wins. Filing under whatever was typed into stage
      // two meant an application Saarthi and the tracker could not then find,
      // because they look the journey up by the number the citizen signed in
      // with — one reference or none.
      citizenRef: signedInPhone() || form.phone || form.uid || name,
      licenceKind: 'learner',
      rtoId: form.rto || api.DEFAULT_RTO,
      idempotencyKey,
      dob: form.dob ?? PRE_BASE.dob,
      applicantName: name,
      licenceClasses: classCodes,
    }));
    if (!submitted) return;   // the error is rendered below; the form is intact

    update({
      applicationId: submitted.application_id,
      app: {
        no: submitted.application_no,
        name,
        phone: form.phone || '98•••• ••21',
        fee: totalFee,
        route: form.route,
        clsName: classCodes.join(', '),
        submittedAt: submitted.created_at,
      },
      stage: 'submitted',
      // Filed, so the resume point goes back to the start. This used to be the
      // whole defence against coming back to a submitted application, and it
      // was the wrong one: it guaranteed a clean step-one wizard rather than
      // refusing to open one. Somebody pressing Back from the slip got exactly
      // that, with a live Submit at the end and a freshly minted idempotency
      // key behind it. The gate in App.tsx is the defence now; this line is
      // only tidying up after a successful filing.
      formStep: 0,
    });
    go('slip');
  };

  // The step heading, so focus can be moved to it. `scrollToTop` moved the page
  // and nothing else: after Continue, focus was still on a button that had just
  // unmounted, which drops a keyboard user back at the top of the document and
  // says nothing about the screen having changed under them.
  const heading = useRef<HTMLHeadingElement>(null);
  const goToStep = (next: number) => {
    setStep(next);
    scrollToTop();
    // After the render that swaps the step in, or it focuses the old heading.
    requestAnimationFrame(() => heading.current?.focus());
  };

  const goNext = () => {
    if (step === 3 && !isAadhaar) { goToStep(4); return; }
    if (step < STEPS.length - 1) goToStep(step + 1);
    else void submit();
  };

  const goBack = () => {
    if (step === 0) go('checklist');
    else if (step === 4 && !isAadhaar) goToStep(2);
    else goToStep(step - 1);
  };

  const visibleSteps = STEPS.filter((_, i) => !(i === 3 && !isAadhaar));
  const currentLabel = STEPS[step].t;
  const currentLabelTranslated = t(STEPS[step].t, STEPS[step].tHi, STEPS[step].tMr);
  const StepComponent = STEP_COMPONENTS[step];

  const stepProps: StepProps = { form, updateForm, classIds, isAadhaar, needsMedicalCert, totalFee, form1Answers, goToStep: setStep };

  return (
    <div className="wrap fade" style={{ padding: '32px 24px 0' }}>
      <div className="row between g16 wrapf applyhead" style={{ marginBottom: 24 }}>
        <div className="col g4"><span className="eyebrow">{t("New learner's licence", 'नई लर्नर लाइसेंस', 'नवीन लर्नर लायसन्स')} · {form.state || 'Maharashtra'}</span><h1 ref={heading} tabIndex={-1} style={{ outline: 'none' }}>{currentLabelTranslated}</h1></div>
        <div className="row g10 wrapf" style={{ alignItems: 'center' }}>
          {/* Demo shortcut. Labelled for what it is rather than hidden, because
              an audience seeing nine stages fill themselves should be told that
              is what happened. */}
          <button className="btn btn-g btn-sm" onClick={fillForDemo} title={t('Fill every stage with the sample applicant and jump to Review', 'हर चरण को नमूना आवेदक से भरें और समीक्षा पर जाएं', 'प्रत्येक टप्पा नमुना अर्जदाराने भरा आणि पुनरावलोकनावर जा')}>
            {Icon.play()} {t('Fill for demo', 'डेमो के लिए भरें', 'डेमोसाठी भरा')}
          </button>
          <Pill tone="ok">{Icon.check()} {t('Saved a moment ago', 'कुछ समय पहले सेव किया गया', 'काही वेळापूर्वी सेव्ह केले')}</Pill>
        </div>
      </div>
      <div className="applygrid">
        <aside className="hide-m"><div style={{ position: 'sticky', top: 88 }}>
          <Stepper steps={visibleSteps.map(s => t(s.t, s.tHi, s.tMr))} cur={visibleSteps.findIndex(s => s.t === currentLabel)} onJump={i => setStep(STEPS.findIndex(s => s.t === visibleSteps[i].t))} />
          <hr className="hr" style={{ margin: '16px 0' }} />
          <p className="tiny mono" style={{ padding: '0 12px', lineHeight: 1.5 }}>{STEPS[step].ref}</p>
          <p className="tiny" style={{ padding: '10px 12px 0' }}>{t('Same stages as the official portal, in the same order. Saved after every step.', 'वही चरण जो आधिकारिक पोर्टल पर हैं, उसी क्रम में। हर चरण के बाद सहेजा जाता है।', 'अधिकृत पोर्टलवर आहेत तेच टप्पे, त्याच क्रमाने. प्रत्येक टप्प्यानंतर सेव्ह केले जाते.')}</p>
        </div></aside>
        <div className="col g20" style={{ maxWidth: 670 }}>
          <div className="only-mb"><Progress cur={visibleSteps.findIndex(s => s.t === currentLabel)} total={visibleSteps.length} label={currentLabelTranslated} /></div>
          <StepComponent {...stepProps} />
          {error && (
            <Note tone="warn" live>
              {t('Not submitted yet.', 'अभी जमा नहीं हुआ।')}{' '}
              {api.isOffline(error)
                ? t('The licence service is not responding. Nothing you filled in has been lost — press Submit again when it is back.', 'लाइसेंस सेवा जवाब नहीं दे रही। आपका भरा हुआ कुछ भी नहीं खोया — सेवा वापस आने पर फिर से जमा करें।')
                : error.message}{' '}
              {t('Pressing Submit again is safe: it cannot create a second application.', 'फिर से जमा करना सुरक्षित है: इससे दूसरा आवेदन नहीं बनेगा।')}
            </Note>
          )}
          {/* Why the button is grey, said outright and next to it.
              `aria-live` because the list shrinks as the page is filled in, and
              somebody using a screen reader should hear it get shorter rather
              than have to go looking for it again. */}
          {outstanding.length > 0 && (
            <div className="col g8" aria-live="polite">
              <span className="label">{t('Still needed on this page', 'इस पन्ने पर अभी ज़रूरी है', 'या पानावर अजून आवश्यक')}</span>
              <ul className="col g4" style={{ margin: 0, paddingLeft: 18 }}>
                {outstanding.map(([en, hi, mr]) => (
                  <li key={en} className="sub">{t(en, hi, mr)}</li>
                ))}
              </ul>
            </div>
          )}
          {/* `state.applicationId` disables Submit as well as the gate in App.tsx
              hiding this screen. Two guards for one failure, because the gate's
              lookup is a network call: for the moment it is in flight the wizard
              is on screen, and this is the button that would file the duplicate. */}
          <Bar back={t('Back', 'पीछे', 'मागे')} onBack={goBack} next={step === STEPS.length - 1 ? (pending === 'submit' ? t('Submitting…', 'जमा हो रहा है…') : t('Submit application', 'आवेदन जमा करें', 'अर्ज सादर करा')) : t('Continue', 'जारी रखें', 'सुरू ठेवा')} onNext={goNext} disabled={!valid || pending === 'submit' || (step === STEPS.length - 1 && Boolean(state.applicationId))} />
        </div>
      </div>
    </div>
  );
}
