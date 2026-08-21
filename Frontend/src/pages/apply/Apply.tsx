import { useState, type ComponentType } from 'react';
import { PRE_BASE, preFor } from '../../data/applicant';
import { STEPS } from '../../data/applicationFlow';
import { FORM1 } from '../../data/documents';
import { feeTotal } from '../../data/fees';
import { CLASSES } from '../../data/vehicleClasses';
import type { ApplicationForm, PageProps } from '../../types';
import { Icon } from '../../ui/Icon';
import { Bar, Pill, Progress, Stepper } from '../../ui/SharedUI';
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
    !!(form.first ?? PRE_BASE.first) && !!(form.email ?? PRE_BASE.email) && !!(form.phone || '').length,
    !!(form.pin ?? preFor(form.state).pin),
    classIds.length > 0,
    form1Done && (!needsMedicalCert || !!form.form1a) && form.conv !== undefined && !!form.organ,
    (isAadhaar ? true : form.photo === 'ok') && form.sign === 'ok' && !!form.docsOk,
    !!form.esign && !!form.captchaOk,
  ][step];
}

/** The nine-stage learner's-licence application wizard. */
export function Apply({ go, state, update }: PageProps) {
  const [step, setStep] = useState(0);
  const form = state.form || {};
  const updateForm = (patch: Partial<ApplicationForm>) => update({ form: { ...form, ...patch } });
  const classIds = form.classes || [];
  const isAadhaar = form.route === 'aadhaar';
  const needsMedicalCert = classIds.some(id => CLASSES.find(c => c.id === id)?.medical);
  const totalFee = feeTotal(classIds, form.state || 'Maharashtra');
  const form1Answers = form.f1 || {};

  const valid = stepValidity({ step, form, isAadhaar, classIds, needsMedicalCert, form1Answers });

  const goNext = () => {
    if (step === 3 && !isAadhaar) { setStep(4); window.scrollTo(0, 0); return; }
    if (step < STEPS.length - 1) { setStep(step + 1); window.scrollTo(0, 0); }
    else {
      update({
        app: {
          no: 'SS-2026-004182',
          name: [form.first ?? PRE_BASE.first, form.last ?? PRE_BASE.last].join(' '),
          phone: form.phone || '98•••• ••21',
          fee: totalFee,
          route: form.route,
          clsName: classIds.map(id => CLASSES.find(c => c.id === id)!.code).join(', '),
        },
        stage: 'submitted',
      });
      go('slip');
    }
  };

  const goBack = () => {
    if (step === 0) go('checklist');
    else if (step === 4 && !isAadhaar) { setStep(2); window.scrollTo(0, 0); }
    else { setStep(step - 1); window.scrollTo(0, 0); }
  };

  const visibleSteps = STEPS.filter((_, i) => !(i === 3 && !isAadhaar));
  const currentLabel = STEPS[step].t;
  const StepComponent = STEP_COMPONENTS[step];

  const stepProps: StepProps = { form, updateForm, classIds, isAadhaar, needsMedicalCert, totalFee, form1Answers, goToStep: setStep };

  return (
    <div className="wrap fade" style={{ padding: '32px 24px 0' }}>
      <div className="row between g16 wrapf" style={{ marginBottom: 24 }}>
        <div className="col g4"><span className="eyebrow">New learner's licence · {form.state || 'Maharashtra'}</span><h1 style={{ fontSize: '1.9rem' }}>{currentLabel}</h1></div>
        <Pill tone="ok">{Icon.check()} Saved a moment ago</Pill>
      </div>
      <div style={{ display: 'grid', gap: 36, gridTemplateColumns: '250px minmax(0,1fr)' }} className="applygrid">
        <aside className="hide-m"><div style={{ position: 'sticky', top: 88 }}>
          <Stepper steps={visibleSteps.map(s => s.t)} cur={visibleSteps.findIndex(s => s.t === currentLabel)} onJump={i => setStep(STEPS.findIndex(s => s.t === visibleSteps[i].t))} />
          <hr className="hr" style={{ margin: '16px 0' }} />
          <p className="tiny mono" style={{ padding: '0 12px', lineHeight: 1.5 }}>{STEPS[step].ref}</p>
          <p className="tiny" style={{ padding: '10px 12px 0' }}>Same stages as the official portal, in the same order. Saved after every step.</p>
        </div></aside>
        <div className="col g20" style={{ maxWidth: 670 }}>
          <div className="only-m"><Progress cur={visibleSteps.findIndex(s => s.t === currentLabel)} total={visibleSteps.length} label={currentLabel} /></div>
          <StepComponent {...stepProps} />
          <Bar back="Back" onBack={goBack} next={step === STEPS.length - 1 ? 'Submit application' : 'Continue'} onNext={goNext} disabled={!valid} />
        </div>
      </div>
    </div>
  );
}
