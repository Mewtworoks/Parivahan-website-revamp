import type { DocumentRequirement } from '../types';

export const DOCS: DocumentRequirement[] = [
  { id: 'id', name: 'Proof of identity', nameHi: 'पहचान प्रमाण', nameMr: 'ओळख पुरावा',
    need: 'Aadhaar, Passport or PAN card', needHi: 'आधार, पासपोर्ट या पैन कार्ड', needMr: 'आधार, पासपोर्ट किंवा पॅन कार्ड',
    via: 'Fetched from DigiLocker', viaHi: 'डिजिलॉकर से लिया गया', viaMr: 'डिजिलॉकरमधून घेतले', auto: true },
  { id: 'addr', name: 'Proof of address', nameHi: 'पता प्रमाण', nameMr: 'पत्ता पुरावा',
    need: 'Aadhaar, electricity bill or rent agreement', needHi: 'आधार, बिजली बिल या किराया अनुबंध', needMr: 'आधार, वीज बिल किंवा भाडे करार',
    via: 'Fetched from DigiLocker', viaHi: 'डिजिलॉकर से लिया गया', viaMr: 'डिजिलॉकरमधून घेतले', auto: true },
  { id: 'dob', name: 'Proof of date of birth', nameHi: 'जन्म तिथि प्रमाण', nameMr: 'जन्मतारीख पुरावा',
    need: 'School certificate, birth certificate or passport', needHi: 'स्कूल प्रमाणपत्र, जन्म प्रमाणपत्र या पासपोर्ट', needMr: 'शाळा प्रमाणपत्र, जन्म प्रमाणपत्र किंवा पासपोर्ट',
    via: 'Fetched from DigiLocker', viaHi: 'डिजिलॉकर से लिया गया', viaMr: 'डिजिलॉकरमधून घेतले', auto: true },
  { id: 'photo', name: 'Passport photo', nameHi: 'पासपोर्ट फोटो', nameMr: 'पासपोर्ट फोटो',
    need: 'Plain background, face clearly visible', needHi: 'सादा पृष्ठभूमि, चेहरा साफ दिखाई दे', needMr: 'साधी पार्श्वभूमी, चेहरा स्पष्ट दिसावा',
    via: 'Take with your camera', viaHi: 'अपने कैमरे से लें', viaMr: 'तुमच्या कॅमेऱ्याने घ्या', auto: false },
  { id: 'sign', name: 'Signature', nameHi: 'हस्ताक्षर', nameMr: 'स्वाक्षरी',
    need: 'Signed on white paper, black pen', needHi: 'सफेद कागज़ पर, काली कलम से हस्ताक्षर', needMr: 'पांढऱ्या कागदावर, काळ्या पेनने स्वाक्षरी',
    via: 'Take with your camera', viaHi: 'अपने कैमरे से लें', viaMr: 'तुमच्या कॅमेऱ्याने घ्या', auto: false },
  { id: 'form1', name: 'Form 1 — self declaration of fitness', nameHi: 'फॉर्म 1 — स्वास्थ्य की स्व-घोषणा', nameMr: 'फॉर्म 1 — तंदुरुस्तीची स्व-घोषणा',
    need: 'For non-transport classes you fill this yourself', needHi: 'गैर-परिवहन श्रेणियों के लिए यह आप खुद भरते हैं', needMr: 'अ-वाहतूक श्रेणींसाठी हे तुम्ही स्वतः भरता',
    via: 'Fill on this screen', viaHi: 'इसी स्क्रीन पर भरें', viaMr: 'याच स्क्रीनवर भरा', auto: false },
];

// Form 1 — Application-cum-Declaration as to Physical Fitness, See Rule 5(2). The real six questions.
// Each row is [key, question, the answer that raises no flag, the question in Hindi].
//
// Hindi is a fourth element rather than a reshaped row on purpose: three files
// destructure this as [key, question, safeAnswer], and appending leaves every
// one of them working untouched. These are statutory questions — the Hindi is a
// plain-language rendering of the same meaning, not a legal translation.
export const FORM1: [string, string, string, string][] = [
  ['a', 'Do you suffer from epilepsy, or from sudden attacks of loss of consciousness or giddiness from any cause?', 'No',
    'क्या आपको मिर्गी है, या किसी भी कारण से अचानक बेहोशी या चक्कर आने के दौरे पड़ते हैं?'],
  ['b', 'Are you able to distinguish with each eye, at a distance of 25 metres, the colours red and green?', 'Yes',
    'क्या आप 25 मीटर की दूरी से, हर आँख से अलग-अलग, लाल और हरा रंग पहचान सकते हैं?'],
  ['c', 'Have you lost either hand or foot, or do you suffer from any defect of muscular control or power of either arm or leg?', 'No',
    'क्या आपका कोई हाथ या पैर कट चुका है, या किसी हाथ या पैर की मांसपेशियों के नियंत्रण या ताकत में कोई कमी है?'],
  ['d', 'Do you suffer from night blindness?', 'No',
    'क्या आपको रतौंधी (रात में कम दिखना) है?'],
  ['e', 'Are you so deaf as to be unable to hear the ordinary sound signal, with or without a hearing aid?', 'No',
    'क्या आप इतना कम सुनते हैं कि सुनने की मशीन के साथ या बिना, सामान्य हॉर्न भी न सुन पाएँ?'],
  ['f', 'Do you suffer from any other disease or disability likely to make your driving a source of danger to the public?', 'No',
    'क्या आपको कोई और ऐसी बीमारी या अशक्तता है जिससे आपका वाहन चलाना लोगों के लिए खतरा बन सकता है?'],
];
