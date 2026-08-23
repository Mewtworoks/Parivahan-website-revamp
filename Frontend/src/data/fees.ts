import { CLASSES, LL_GRANT, LL_TEST } from './vehicleClasses';
import type { FeeLine } from '../types';

// States add their own charges on top of the central schedule, and you only find out on the
// payment page. Bihar's real receipt for MCWG+LMV comes to Rs.740; Maharashtra's to Rs.350.
// Figures below are illustrative of the named heads on an actual receipt.
export const STATE_FEES: Record<string, FeeLine[]> = {
  Bihar: [
    { k: 'Road safety fee', v: 140, per: 'once', rule: 'Bihar-specific levy, funds the road safety tutorial' },
    { k: 'Surcharge (LL)', v: 50, per: 'class', rule: 'State surcharge, charged per class' },
    { k: 'Inspection fee', v: 75, per: 'class', rule: 'State inspection charge, per class' },
  ],
};

// Address unit below district varies by state — the label changes, the field does not.
export const ADDR_UNIT: Record<string, string> = { Bihar: 'C.D. Block', Delhi: 'Sub-district', 'Uttar Pradesh': 'Tehsil', Maharashtra: 'Taluka' };

export const FEE_DOC: [string, string][] = [
  ['Age proof', 'Birth certificate, school leaving certificate, passport or PAN card'],
  ['Address proof', 'Passport, electricity bill, rent agreement or ration card'],
];

export const FEE_DL: FeeLine[] = [
  { k: 'Grant of driving licence', v: 200, rule: 'Includes the smart card' },
  { k: 'Driving test fee', v: 300, rule: 'Per class, payable again on a retest' },
];

export function feeRows(classIds: string[], state: string): FeeLine[] {
  const rows: FeeLine[] = classIds.map(id => {
    const cls = CLASSES.find(c => c.id === id)!;
    return { k: `Issue of new LL — ${cls.code}`, v: LL_GRANT, rule: '₹150 per class, central schedule' };
  });
  if (classIds.length) rows.push({ k: 'LL test fee', v: LL_TEST, rule: 'Charged once, however many classes you add' });
  (STATE_FEES[state] || []).forEach(extra => {
    if (extra.per === 'class') {
      classIds.forEach(id => rows.push({ k: `${extra.k} — ${CLASSES.find(c => c.id === id)!.code}`, v: extra.v, rule: extra.rule, state: true }));
    } else if (classIds.length) {
      rows.push({ k: extra.k, v: extra.v, rule: extra.rule, state: true });
    }
  });
  return rows;
}

export function feeTotal(classIds: string[], state: string): number {
  return feeRows(classIds, state).reduce((sum, row) => sum + row.v, 0);
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Spells out a rupee amount, the way an official receipt does ("Three hundred and fifty rupees only"). */
export function inWords(n: number): string {
  if (n === 0) return 'Zero rupees only';
  const hundreds = ['', 'one hundred', 'two hundred', 'three hundred', 'four hundred', 'five hundred', 'six hundred', 'seven hundred', 'eight hundred', 'nine hundred'];
  const tens = ['', 'ten', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const teens: Record<number, string> = { 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen' };
  const thousands = Math.floor(n / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (thousands) parts.push(ONES[thousands] + ' thousand');
  if (hundred) parts.push(hundreds[hundred]);
  if (rest >= 10 && rest < 20) parts.push(teens[rest]);
  else {
    if (Math.floor(rest / 10)) parts.push(tens[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(ONES[rest % 10]);
  }
  const words = parts.join(' ') + ' rupees only';
  return words.charAt(0).toUpperCase() + words.slice(1);
}
