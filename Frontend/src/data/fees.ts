import { CLASSES, LL_GRANT, LL_TEST } from './vehicleClasses';
import type { FeeLine } from '../types';

// States add their own charges on top of the central schedule, and you only find out on the
// payment page. Bihar's real receipt for MCWG+LMV comes to Rs.740; Maharashtra's to Rs.350.
// Figures below are illustrative of the named heads on an actual receipt.
export const STATE_FEES: Record<string, FeeLine[]> = {
  Bihar: [
    { k: 'Road safety fee', kHi: 'सड़क सुरक्षा शुल्क', kMr: 'रस्ता सुरक्षा शुल्क', v: 140, per: 'once',
      rule: 'Bihar-specific levy, funds the road safety tutorial', ruleHi: 'बिहार का अपना शुल्क, सड़क सुरक्षा ट्यूटोरियल के लिए', ruleMr: 'बिहारचा स्वतःचा शुल्क, रस्ता सुरक्षा ट्युटोरियलसाठी' },
    { k: 'Surcharge (LL)', kHi: 'अधिभार (एलएल)', kMr: 'अधिभार (एलएल)', v: 50, per: 'class',
      rule: 'State surcharge, charged per class', ruleHi: 'राज्य अधिभार, हर श्रेणी पर', ruleMr: 'राज्य अधिभार, प्रत्येक श्रेणीवर' },
    { k: 'Inspection fee', kHi: 'निरीक्षण शुल्क', kMr: 'तपासणी शुल्क', v: 75, per: 'class',
      rule: 'State inspection charge, per class', ruleHi: 'राज्य निरीक्षण शुल्क, प्रति श्रेणी', ruleMr: 'राज्य तपासणी शुल्क, प्रति श्रेणी' },
  ],
};

// Address unit below district varies by state — the label changes, the field does not.
export const ADDR_UNIT: Record<string, string> = { Bihar: 'C.D. Block', Delhi: 'Sub-district', 'Uttar Pradesh': 'Tehsil', Maharashtra: 'Taluka' };

// [label, detail, labelHi, detailHi] — Hindi appended so existing [k, v] destructuring still works.
export const FEE_DOC: [string, string, string, string][] = [
  ['Age proof', 'Birth certificate, school leaving certificate, passport or PAN card',
    'आयु प्रमाण', 'जन्म प्रमाणपत्र, स्कूल छोड़ने का प्रमाणपत्र, पासपोर्ट या पैन कार्ड'],
  ['Address proof', 'Passport, electricity bill, rent agreement or ration card',
    'पता प्रमाण', 'पासपोर्ट, बिजली बिल, किराया अनुबंध या राशन कार्ड'],
];

export const FEE_DL: FeeLine[] = [
  { k: 'Grant of driving licence', kHi: 'ड्राइविंग लाइसेंस जारी करना', kMr: 'ड्रायव्हिंग लायसन्स जारी करणे', v: 200,
    rule: 'Includes the smart card', ruleHi: 'स्मार्ट कार्ड शामिल है', ruleMr: 'स्मार्ट कार्ड समाविष्ट आहे' },
  { k: 'Driving test fee', kHi: 'ड्राइविंग टेस्ट शुल्क', kMr: 'ड्रायव्हिंग टेस्ट शुल्क', v: 300,
    rule: 'Per class, payable again on a retest', ruleHi: 'प्रति श्रेणी, दोबारा परीक्षा पर फिर देना होगा', ruleMr: 'प्रति श्रेणी, पुन्हा परीक्षेवर पुन्हा भरावे लागेल' },
];

export function feeRows(classIds: string[], state: string): FeeLine[] {
  // The class code (MCWG, LMV-NT) stays Latin in every language — it is what is
  // printed on the licence and on the counter's receipt, so translating it would
  // make the two impossible to match up.
  const rows: FeeLine[] = classIds.map(id => {
    const cls = CLASSES.find(c => c.id === id)!;
    return {
      k: `Issue of new LL — ${cls.code}`, kHi: `नया एलएल जारी करना — ${cls.code}`, kMr: `नवीन एलएल जारी करणे — ${cls.code}`,
      v: LL_GRANT,
      rule: '₹150 per class, central schedule', ruleHi: '₹150 प्रति श्रेणी, केंद्रीय अनुसूची', ruleMr: '₹150 प्रति श्रेणी, केंद्रीय अनुसूची',
    };
  });
  if (classIds.length) rows.push({
    k: 'LL test fee', kHi: 'एलएल परीक्षा शुल्क', kMr: 'एलएल परीक्षा शुल्क', v: LL_TEST,
    rule: 'Charged once, however many classes you add', ruleHi: 'एक ही बार लिया जाता है, चाहे आप कितनी भी श्रेणियाँ जोड़ें', ruleMr: 'एकदाच घेतले जाते, तुम्ही कितीही श्रेणी जोडल्या तरी',
  });
  (STATE_FEES[state] || []).forEach(extra => {
    if (extra.per === 'class') {
      classIds.forEach(id => {
        const code = CLASSES.find(c => c.id === id)!.code;
        rows.push({
          ...extra,
          k: `${extra.k} — ${code}`,
          kHi: extra.kHi && `${extra.kHi} — ${code}`,
          kMr: extra.kMr && `${extra.kMr} — ${code}`,
          state: true,
        });
      });
    } else if (classIds.length) {
      rows.push({ ...extra, state: true });
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

/**
 * The same amount in Hindi, for the receipt.
 *
 * Spelled out from a table rather than composed from tens and units, because
 * Hindi below a hundred does not compose: 45 is पैंतालीस, not चालीस पाँच. Every
 * value 1–99 is its own word, so anything cleverer than a lookup is wrong.
 */
const HI_UNDER_100 = [
  '', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी',
  'नब्बे', 'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे',
];

export function inWordsHi(n: number): string {
  if (n === 0) return 'शून्य रुपये मात्र';
  const parts: string[] = [];
  const thousands = Math.floor(n / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  if (thousands) parts.push(`${HI_UNDER_100[thousands]} हज़ार`);
  if (hundred) parts.push(`${HI_UNDER_100[hundred]} सौ`);
  if (rest) parts.push(HI_UNDER_100[rest]);
  return parts.join(' ') + ' रुपये मात्र';
}
