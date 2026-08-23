import type { PrefilledApplicant } from '../types';

/** Sample applicant used to pre-fill the demo — stands in for what a real e-KYC fetch would return. */
export const PRE_BASE = {
  first: 'Rehan', mid: 'Qais', last: 'Mirza', dob: '2005-04-12', gender: 'Male', blood: 'B+',
  relType: 'Son of', relFirst: 'Qais', relLast: 'Mirza', cob: 'India', qual: 'Class 12 or equivalent',
  mark1: 'Mole on left cheek', mark2: 'Scar on right forearm', emPhone: '98•••• ••07', email: 'rehan.mirza@example.in',
  stayY: '12', stayM: '4',
};

// The e-KYC record follows the state, so the confirm screen never shows an address
// that contradicts the office you picked.
const PRE_ADDR: Record<string, Omit<PrefilledApplicant, keyof typeof PRE_BASE | 'state'>> = {
  Maharashtra: { pob: 'Mumbai', line: '402, Sundar Niwas', street: 'Gokhale Road North', landmark: 'Near Shivaji Park', area: 'Dadar West', city: 'Mumbai', district: 'Mumbai City', block: 'Mumbai City', pin: '400028', vt: 'Town' },
  Bihar: { pob: 'Samastipur', line: 'House no. 38', street: 'Ward 4, Kashipur Road', landmark: 'Near Ganga Chowk', area: 'Kashipur', city: 'Kashipur', district: 'Samastipur', block: 'Tajpur', pin: '848505', vt: 'Village' },
};

/** The prefilled applicant record for a given state — Maharashtra and Bihar are the only ones modelled. */
export function preFor(state?: string): PrefilledApplicant {
  return { ...PRE_BASE, ...(PRE_ADDR[state || 'Maharashtra'] || PRE_ADDR.Maharashtra), state: state || 'Maharashtra' };
}

export const PRE = preFor('Maharashtra');

export const SEED_STATUS = {
  no: 'SS-2026-004182', name: 'Rehan Q. Mirza', kind: "Learner's Licence", cls: 'LMV-NT, MCWG',
};
