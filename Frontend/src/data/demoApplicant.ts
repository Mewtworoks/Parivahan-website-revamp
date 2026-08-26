import { FORM1 } from './documents';
import { preFor } from './applicant';
import type { ApplicationForm } from '../types';

/**
 * Every answer the nine-stage wizard needs, in one object.
 *
 * Filling the form by hand in front of an audience costs several minutes of
 * typing that demonstrates nothing — the argument of this build is what the
 * service does after Submit, not that a form can be typed into. This skips to
 * that, and skips it honestly: these are the same values the wizard would hold
 * had someone entered them, so the application that gets submitted is a real
 * one and every screen after it behaves exactly as it would.
 *
 * Kept beside the other seed data rather than inside the wizard so the shape
 * stays checked against `ApplicationForm` — a field renamed in the form is a
 * type error here rather than a step that silently fails to validate on stage.
 */
export function demoForm(state = 'Maharashtra'): ApplicationForm {
  const pre = preFor(state);

  return {
    // S0 — where. Bihar is the other modelled state; the rest fall back to the
    // Maharashtra office list, same as the picker.
    state,
    rto: state === 'Bihar' ? 'br33' : 'mh01',

    // S1 — first licence, Aadhaar route. Aadhaar is the route worth showing:
    // it is the one that removes the RTO visit.
    cat: 'none',
    route: 'aadhaar',

    // S2 — identity. 999999999999 is not an issuable Aadhaar (real ones never
    // begin with 0 or 1 and this is the reserved all-nines test value), so the
    // number on screen cannot belong to anybody.
    idType: 'uid',
    uid: '999999999999',
    phone: '9820011021',
    cons: { a: true, b: true, c: true },
    kyc: true,

    // S2b — the e-KYC record comes back and is confirmed.
    kycOk: true,

    // S3 + S4 — personal details and address, exactly what preFor() would have
    // returned from the e-KYC fetch for this state.
    first: pre.first, mid: pre.mid, last: pre.last, dob: pre.dob,
    gender: pre.gender, blood: pre.blood, qual: pre.qual,
    relType: pre.relType, relFirst: pre.relFirst, relLast: pre.relLast,
    pob: pre.pob, cob: pre.cob, email: pre.email, emPhone: pre.emPhone,
    mark1: pre.mark1, mark2: pre.mark2, disab: 'No',
    line: pre.line, street: pre.street, landmark: pre.landmark, area: pre.area,
    district: pre.district, block: pre.block, pin: pre.pin, vt: pre.vt,
    city: pre.city, stayY: pre.stayY, stayM: pre.stayM,
    same: true, addrDoc: true,

    // S5 — two classes, which is what makes the fee ₹350 rather than ₹200.
    // Neither needs a Form 1A medical certificate, so stage 7 stays valid.
    classes: ['LMV-NT', 'MCWG'],
    school: 'No',

    // S6 — Form 1. The declared answer for each question is the third element
    // of its FORM1 row, so this cannot drift from the questions being asked.
    f1: Object.fromEntries(FORM1.map(([key, , answer]) => [key, answer])),
    f1sign: true,
    organ: 'Yes',
    conv: 'No',
    foreign: 'No',

    // S7 — photo, signature and documents accepted.
    photo: 'ok',
    sign: 'ok',
    docsOk: true,

    // S8 — e-sign and captcha cleared, so Submit is live.
    esign: true,
    captchaOk: true,
  };
}
