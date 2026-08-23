import type { DocumentRequirement } from '../types';

export const DOCS: DocumentRequirement[] = [
  { id: 'id', name: 'Proof of identity', need: 'Aadhaar, Passport or PAN card', via: 'Fetched from DigiLocker', auto: true },
  { id: 'addr', name: 'Proof of address', need: 'Aadhaar, electricity bill or rent agreement', via: 'Fetched from DigiLocker', auto: true },
  { id: 'dob', name: 'Proof of date of birth', need: 'School certificate, birth certificate or passport', via: 'Fetched from DigiLocker', auto: true },
  { id: 'photo', name: 'Passport photo', need: 'Plain background, face clearly visible', via: 'Take with your camera', auto: false },
  { id: 'sign', name: 'Signature', need: 'Signed on white paper, black pen', via: 'Take with your camera', auto: false },
  { id: 'form1', name: "Form 1 — self declaration of fitness", need: 'For non-transport classes you fill this yourself', via: 'Fill on this screen', auto: false },
];

// Form 1 — Application-cum-Declaration as to Physical Fitness, See Rule 5(2). The real six questions.
// Each row is [key, question, the answer that raises no flag].
export const FORM1: [string, string, string][] = [
  ['a', 'Do you suffer from epilepsy, or from sudden attacks of loss of consciousness or giddiness from any cause?', 'No'],
  ['b', 'Are you able to distinguish with each eye, at a distance of 25 metres, the colours red and green?', 'Yes'],
  ['c', 'Have you lost either hand or foot, or do you suffer from any defect of muscular control or power of either arm or leg?', 'No'],
  ['d', 'Do you suffer from night blindness?', 'No'],
  ['e', 'Are you so deaf as to be unable to hear the ordinary sound signal, with or without a hearing aid?', 'No'],
  ['f', 'Do you suffer from any other disease or disability likely to make your driving a source of danger to the public?', 'No'],
];
