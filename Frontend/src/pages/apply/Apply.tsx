import { useRef, type ComponentType } from 'react';
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

/** Whether each step's required fields are filled, indexed the same way as STEPS/STEP_COMPONENTS. */
function stepValidity({ step, form, isAadhaar, classIds, needsMedicalCert, form1Answers }: {
  step: number; form: ApplicationForm; isAadhaar: boolean; classIds: string[]; needsMedicalCert: boolean; form1Answers: Record<string, string>;
}): boolean {
  const form1Done = FORM1.every(([key]) => form1Answers[key]) && !!form.f1sign;
  return [
    true,
    !!form.cat && !!form.route,
    isAadhaar ? !!form.kyc : !!form.manualOk,
    !isAadhaar || !!form.kycOk,
    !!(form.first ?? PRE_BASE.first) && isValidEmail((form.email ?? PRE_BASE.email) as string) && isValidMobile(form.phone || ''),
    isValidPin((form.pin ?? preFor(form.state).pin) as string),
    classIds.length > 0,
    form1Done && (!needsMedicalCert || !!form.form1a) && form.conv !== undefined && !!form.organ,
    (isAadhaar ? true : form.photo === 'ok') && form.sign === 'ok' && !!form.docsOk,
    !!form.esign && !!form.captchaOk,
  ][step];
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

  const valid = stepValidity({ step, form, isAadhaar, classIds, needsMedicalCert, form1Answers });

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
      // Filed. The resume point goes with it, so somebody who starts a second
      // application is not dropped onto the review stage of the one they just
      // sent, looking at a Submit button for an application that already exists.
      formStep: 0,
    });
    go('slip');
  };

  const goNext = () => {
    if (step === 3 && !isAadhaar) { setStep(4); scrollToTop(); return; }
    if (step < STEPS.length - 1) { setStep(step + 1); scrollToTop(); }
    else void submit();
  };

  const goBack = () => {
    if (step === 0) go('checklist');
    else if (step === 4 && !isAadhaar) { setStep(2); scrollToTop(); }
    else { setStep(step - 1); scrollToTop(); }
  };

  const visibleSteps = STEPS.filter((_, i) => !(i === 3 && !isAadhaar));
  const currentLabel = STEPS[step].t;
  const currentLabelTranslated = t(STEPS[step].t, STEPS[step].tHi, STEPS[step].tMr);
  const StepComponent = STEP_COMPONENTS[step];

  const stepProps: StepProps = { form, updateForm, classIds, isAadhaar, needsMedicalCert, totalFee, form1Answers, goToStep: setStep };

  return (
    <div className="wrap fade" style={{ padding: '32px 24px 0' }}>
      <div className="row between g16 wrapf" style={{ marginBottom: 24 }}>
        <div className="col g4"><span className="eyebrow">{t("New learner's licence", 'नई लर्नर लाइसेंस', 'नवीन लर्नर लायसन्स')} · {form.state || 'Maharashtra'}</span><h1 style={{ fontSize: '1.9rem' }}>{currentLabelTranslated}</h1></div>
        <div className="row g10 wrapf" style={{ alignItems: 'center' }}>
          {/* Demo shortcut. Labelled for what it is rather than hidden, because
              an audience seeing nine stages fill themselves should be told that
              is what happened. */}
          <button className="btn btn-g btn-sm" onClick={fillForDemo} title="Fill every stage with the sample applicant and jump to Review">
            {Icon.play()} {t('Fill for demo', 'डेमो के लिए भरें', 'डेमोसाठी भरा')}
          </button>
          <Pill tone="ok">{Icon.check()} {t('Saved a moment ago', 'कुछ समय पहले सेव किया गया', 'काही वेळापूर्वी सेव्ह केले')}</Pill>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 36, gridTemplateColumns: '250px minmax(0,1fr)' }} className="applygrid">
        <aside className="hide-m"><div style={{ position: 'sticky', top: 88 }}>
          <Stepper steps={visibleSteps.map(s => t(s.t, s.tHi, s.tMr))} cur={visibleSteps.findIndex(s => s.t === currentLabel)} onJump={i => setStep(STEPS.findIndex(s => s.t === visibleSteps[i].t))} />
          <hr className="hr" style={{ margin: '16px 0' }} />
          <p className="tiny mono" style={{ padding: '0 12px', lineHeight: 1.5 }}>{STEPS[step].ref}</p>
          <p className="tiny" style={{ padding: '10px 12px 0' }}>Same stages as the official portal, in the same order. Saved after every step.</p>
        </div></aside>
        <div className="col g20" style={{ maxWidth: 670 }}>
          <div className="only-m"><Progress cur={visibleSteps.findIndex(s => s.t === currentLabel)} total={visibleSteps.length} label={currentLabelTranslated} /></div>
          <StepComponent {...stepProps} />
          {error && (
            <Note tone="warn">
              <b>{t('Not submitted yet.', 'अभी जमा नहीं हुआ।')}</b>{' '}
              {api.isOffline(error)
                ? t('The licence service is not responding. Nothing you filled in has been lost — press Submit again when it is back.', 'लाइसेंस सेवा जवाब नहीं दे रही। आपका भरा हुआ कुछ भी नहीं खोया — सेवा वापस आने पर फिर से जमा करें।')
                : error.message}{' '}
              {t('Pressing Submit again is safe: it cannot create a second application.', 'फिर से जमा करना सुरक्षित है: इससे दूसरा आवेदन नहीं बनेगा।')}
            </Note>
          )}
          <Bar back={t('Back', 'पीछे', 'मागे')} onBack={goBack} next={step === STEPS.length - 1 ? (pending === 'submit' ? t('Submitting…', 'जमा हो रहा है…') : t('Submit application', 'आवेदन जमा करें', 'अर्ज सादर करा')) : t('Continue', 'जारी रखें', 'सुरू ठेवा')} onNext={goNext} disabled={!valid || pending === 'submit'} />
        </div>
      </div>
    </div>
  );
}
