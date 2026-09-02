import type { Route } from '../types';

export type FooterTarget = { go: Route } | { info: string } | { help: true } | { grievance: true };
export type FooterLink = [label: string, target: FooterTarget];
export type FooterColumn = [heading: string, links: FooterLink[]];

// Footer link targets: either a route jump, or a panel of real content.
export const FOOTER_COLUMNS: FooterColumn[] = [
  ["Learner's licence", [['Check eligibility', { go: 'elig' }], ['Apply', { go: 'checklist' }], ['Practice test', { go: 'learn' }], ['Book a slot', { go: 'slot' }], ['Road safety tutorial', { go: 'tutorial' }]]],
  // DL journey parked: the two links that opened the wizard are gone; the two
  // that open reference panels stay, because that content is real. Titled as
  // reference, not as a service — a column headed "Driving licence" under a
  // learner's-only home page reads as a second journey that is not there.
  ['Driving licence · reference', [['Driving test tracks', { info: 'tracks' }], ['Fees', { info: 'fees' }]]],
  ['Help', [['How a document is verified', { info: 'verify' }], ['What each fee pays for', { info: 'fees' }], ['Report a problem', { grievance: true }], ['Call 1800 000 000', { help: true }]]],
  ['About this build', [['Problem and approach', { info: 'problem' }], ['What is mocked', { info: 'mocked' }],
    // The staff view and the runnable guarantees. Part of the argument rather
    // than developer tooling, but the top bar had no room left for them.
    ['Inspector desk', { go: 'desk' }], ['See the guarantees run', { go: 'proof' }],
    ['Where people actually fail', { go: 'learning' }],
    ['Accessibility', { info: 'a11y' }], ['Source', { info: 'source' }]]],
];

/**
 * One block inside a panel. Hindi sits beside its English rather than in a
 * lookup keyed on the English string: these paragraphs are long enough that a
 * lookup key would be a whole sentence, and editing the English copy would
 * silently drop the translation instead of failing.
 */
export interface InfoSection {
  h: string;
  hHi?: string;
  hMr?: string;
  rows?: [string, string][];
  rowsHi?: [string, string][];
  p?: string;
  pHi?: string;
  pMr?: string;
}

export interface InfoPanel {
  t: string;
  tHi?: string;
  tMr?: string;
  body: InfoSection[];
}

export const INFO_PANELS: Record<string, InfoPanel> = {
  fees: {
    t: 'What each fee pays for', tHi: 'हर शुल्क किसलिए है', body: [
      {
        h: "Learner's licence — ₹200 per class", hHi: 'लर्नर लाइसेंस — ₹200 प्रति श्रेणी',
        rows: [['Grant of learner\'s licence (Form 3)', '₹150'], ["Learner's licence test fee", '₹50']],
        rowsHi: [['लर्नर लाइसेंस जारी करना (फॉर्म 3)', '₹150'], ['लर्नर लाइसेंस परीक्षा शुल्क', '₹50']],
        p: 'Charged once per class of vehicle. Two classes on one application means ₹400, but still one test sitting and one visit. A failed test costs the ₹50 again on rebooking, not the whole ₹200.',
        pHi: 'प्रति वाहन श्रेणी एक बार लिया जाता है। एक ही आवेदन में दो श्रेणियाँ यानी ₹400, लेकिन परीक्षा एक ही बार और कार्यालय का एक ही चक्कर। परीक्षा में असफल होने पर दोबारा बुकिंग पर सिर्फ ₹50 लगते हैं, पूरे ₹200 नहीं।',
      },
      {
        h: 'Driving licence — ₹500 per class', hHi: 'ड्राइविंग लाइसेंस — ₹500 प्रति श्रेणी',
        rows: [['Grant of driving licence, including the smart card', '₹200'], ['Driving test fee', '₹300']],
        rowsHi: [['ड्राइविंग लाइसेंस जारी करना, स्मार्ट कार्ड सहित', '₹200'], ['ड्राइविंग टेस्ट शुल्क', '₹300']],
        p: 'The smart card is included in the ₹200. A retest is another ₹300.',
        pHi: 'स्मार्ट कार्ड ₹200 में शामिल है। दोबारा परीक्षा देने पर ₹300 और लगते हैं।',
      },
      {
        h: 'What is never charged', hHi: 'जो कभी नहीं लिया जाता',
        p: 'No service charge, no portal charge, no facilitation fee. The lines above are the complete schedule, published up front so you can check any amount against it and pay the exact sum yourself, directly.',
        pHi: 'कोई सेवा शुल्क नहीं, कोई पोर्टल शुल्क नहीं, कोई सुविधा शुल्क नहीं। ऊपर दी गई पंक्तियाँ ही पूरी अनुसूची हैं, पहले से प्रकाशित — ताकि आप किसी भी राशि को इससे मिलाकर देख सकें और सही रकम खुद, सीधे भर सकें।',
      },
    ],
  },
  verify: {
    t: 'How a document is verified', tHi: 'दस्तावेज़ सत्यापन कैसे होता है', body: [
      {
        h: 'The route decides everything', hHi: 'रास्ता ही सब तय करता है',
        p: 'If you authenticate with Aadhaar, your name, date of birth and address arrive from an existing government record. Nothing is retyped, so nothing can mismatch. Without Aadhaar you type the details and upload a scan, which a clerk compares by eye — that is why the manual route usually adds a verification visit.',
        pHi: 'अगर आप आधार से सत्यापन करते हैं, तो आपका नाम, जन्म तिथि और पता पहले से मौजूद सरकारी रिकॉर्ड से आते हैं। कुछ भी दोबारा टाइप नहीं होता, इसलिए कुछ भी बेमेल नहीं हो सकता। आधार के बिना आप विवरण खुद टाइप करते हैं और स्कैन अपलोड करते हैं, जिसे क्लर्क आँख से मिलाता है — इसीलिए मैनुअल रास्ते में आमतौर पर एक सत्यापन चक्कर और जुड़ जाता है।',
      },
      {
        h: 'What is checked instantly here', hHi: 'यहाँ तुरंत क्या जाँचा जाता है',
        p: 'File size and format, whether your face is fully inside the frame, whether the signature runs off the paper, and whether the name on the proof matches what the application says. All four are things the counter would otherwise send you home for.',
        pHi: 'फ़ाइल का आकार और प्रारूप, आपका चेहरा पूरा फ़्रेम के अंदर है या नहीं, हस्ताक्षर कागज़ से बाहर तो नहीं जा रहा, और प्रमाण पर लिखा नाम आवेदन से मेल खाता है या नहीं। ये चारों वही बातें हैं जिनके लिए काउंटर आपको वापस घर भेज देता।',
      },
      {
        h: 'What a real build would need behind it', hHi: 'असली सिस्टम को पीछे क्या चाहिए',
        p: 'A consent-based e-KYC integration, an audit log the applicant can read, revocable consent, and a document store that keeps a signed reference rather than a copy of your Aadhaar.',
        pHi: 'सहमति-आधारित e-KYC एकीकरण, एक ऑडिट लॉग जिसे आवेदक खुद पढ़ सके, वापस ली जा सकने वाली सहमति, और एक दस्तावेज़ भंडार जो आपके आधार की नकल के बजाय एक हस्ताक्षरित संदर्भ रखे।',
      },
    ],
  },
  tracks: {
    t: 'Driving test tracks', tHi: 'ड्राइविंग टेस्ट ट्रैक', body: [
      {
        h: 'What an automated track tests', hHi: 'स्वचालित ट्रैक क्या परखता है',
        p: 'Reversing in an S or figure-of-eight, a gradient start, lane discipline and a controlled stop. Sensors log the run, which removes most of the argument about a fail.',
        pHi: 'S या आठ के आकार में रिवर्स करना, ढलान पर गाड़ी शुरू करना, लेन अनुशासन और नियंत्रित ढंग से रोकना। सेंसर पूरा चक्कर दर्ज करते हैं, जिससे फेल होने पर होने वाली ज़्यादातर बहस खत्म हो जाती है।',
      },
      {
        h: 'You bring the vehicle', hHi: 'वाहन आपको लाना है',
        p: 'The RTO does not provide one. It must be of the class you are testing for and carry valid registration, insurance and a PUC certificate. This is the single most common reason a booked driving test is wasted.',
        pHi: 'आरटीओ वाहन नहीं देता। वह उसी श्रेणी का होना चाहिए जिसकी परीक्षा आप दे रहे हैं, और उसके पास वैध पंजीकरण, बीमा और पीयूसी प्रमाणपत्र होना चाहिए। बुक किया गया ड्राइविंग टेस्ट बेकार जाने की यह सबसे आम वजह है।',
      },
      {
        h: 'If you do not own one', hHi: 'अगर आपके पास वाहन नहीं है',
        p: 'Driving schools at each track rent a vehicle with an instructor for the test slot. A real build would list which schools operate at your chosen track and what they charge, so the cost is known before you book.',
        pHi: 'हर ट्रैक पर मौजूद ड्राइविंग स्कूल परीक्षा के स्लॉट के लिए प्रशिक्षक सहित वाहन किराए पर देते हैं। असली सिस्टम में यह सूची होती कि आपके चुने ट्रैक पर कौन से स्कूल चलते हैं और वे कितना लेते हैं, ताकि बुकिंग से पहले लागत पता हो।',
      },
    ],
  },
  problem: {
    t: 'Problem and approach', tHi: 'समस्या और दृष्टिकोण', body: [
      {
        h: 'Who faces it', hHi: 'यह किसे झेलनी पड़ती है',
        p: 'First-time applicants, usually 16 to 25, applying without help. The people who struggle most are the ones doing it alone on a phone, on a slow connection, with no idea what the next screen will ask for.',
        pHi: 'पहली बार आवेदन करने वाले, आमतौर पर 16 से 25 साल के, बिना किसी मदद के। सबसे ज़्यादा दिक्कत उन्हें होती है जो अकेले, फोन पर, धीमे कनेक्शन पर यह कर रहे हैं, और जिन्हें पता ही नहीं कि अगली स्क्रीन क्या माँगेगी।',
      },
      {
        h: 'What is hard today', hHi: 'आज क्या मुश्किल है',
        p: 'The stages are scattered across separate menu items reached with an application number. Nothing tells you the total cost up front, nothing explains what a document is for, a booked slot does not behave like an appointment, and a rejection arrives without a reason you can act on.',
        pHi: 'चरण अलग-अलग मेन्यू में बिखरे हैं और हर एक तक पहुँचने के लिए आवेदन संख्या चाहिए। कुल लागत पहले से कहीं नहीं बताई जाती, कोई नहीं समझाता कि दस्तावेज़ किसलिए है, बुक किया गया स्लॉट अपॉइंटमेंट जैसा व्यवहार नहीं करता, और अस्वीकृति ऐसा कारण लेकर आती है जिस पर आप कुछ कर ही नहीं सकते।',
      },
      {
        h: 'What changed', hHi: 'क्या बदला',
        p: 'Same stages, same forms, same order — so the process behind it is untouched. One decision per screen. Fetch instead of retype. Every fee named with its rule. Validation at the moment of capture rather than at the counter. Slots that publish real remaining capacity.',
        pHi: 'वही चरण, वही फॉर्म, वही क्रम — यानी पीछे की प्रक्रिया अछूती है। हर स्क्रीन पर एक ही फैसला। दोबारा टाइप करने के बजाय जानकारी खुद आती है। हर शुल्क अपने नियम के साथ नाम से बताया गया। जाँच काउंटर पर नहीं, उसी पल जब जानकारी भरी जाती है। स्लॉट जो असली बची हुई क्षमता दिखाते हैं।',
      },
      {
        h: 'Why it is better', hHi: 'यह बेहतर क्यों है',
        p: 'The failure modes that cost a wasted trip — a bad photo, a name mismatch, a missing receipt, a class you forgot to add — are caught on the screen where they are created.',
        pHi: 'जिन गलतियों से एक पूरा चक्कर बेकार जाता है — खराब फोटो, नाम में अंतर, गुम रसीद, कोई श्रेणी जोड़ना भूल जाना — वे उसी स्क्रीन पर पकड़ी जाती हैं जहाँ वे बनती हैं।',
      },
    ],
  },
  mocked: {
    t: 'What is mocked', tHi: 'क्या नकली है', body: [
      {
        h: 'Works end to end', hHi: 'शुरू से आखिर तक काम करता है',
        p: "Eligibility check, the nine-stage learner's licence application with per-step validation, fee calculation, slot booking, the practice game with its adaptive report card, the tracker, the driving-licence upgrade wizard, and filing a grievance against an application.",
        pHi: 'पात्रता जाँच, नौ चरणों वाला लर्नर लाइसेंस आवेदन जिसमें हर चरण की अपनी जाँच है, शुल्क गणना, स्लॉट बुकिंग, अभ्यास खेल और उसका बदलता रिपोर्ट कार्ड, ट्रैकर, ड्राइविंग लाइसेंस अपग्रेड विज़ार्ड, और किसी आवेदन के खिलाफ शिकायत दर्ज करना।',
      },
      {
        h: 'Mocked', hHi: 'नकली',
        p: 'Every OTP, the Aadhaar e-KYC fetch, the payment gateway, all document uploads, RTO capacity numbers, and the licence itself. No real Aadhaar, PAN, payment or personal data is used anywhere, and no government system is contacted.',
        pHi: 'हर ओटीपी, आधार e-KYC फ़ेच, भुगतान गेटवे, सभी दस्तावेज़ अपलोड, आरटीओ क्षमता के आंकड़े, और लाइसेंस खुद। कहीं भी असली आधार, पैन, भुगतान या निजी जानकारी इस्तेमाल नहीं होती, और किसी सरकारी सिस्टम से संपर्क नहीं किया जाता।',
      },
      {
        h: 'Designed but not built', hHi: 'डिज़ाइन किया, बनाया नहीं',
        p: 'The practical-test track levels of the practice game — the automated-track hazards described under "Driving test tracks" are not yet a playable module.',
        pHi: 'अभ्यास खेल के व्यावहारिक-परीक्षा ट्रैक स्तर — "ड्राइविंग टेस्ट ट्रैक" में बताए गए स्वचालित ट्रैक के खतरे अभी खेलने लायक हिस्सा नहीं बने हैं।',
      },
      {
        h: 'Known limits', hHi: 'ज्ञात सीमाएँ',
        p: "Maharashtra and Bihar are the only states with real data behind them. Fees follow the central schedule and would need a per-state table. The practice bank is forty situations across nine competencies, not the full official question bank. The driving-licence wizard skips its own 30-day waiting period on request, since a demo can't wait a month.",
        pHi: 'सिर्फ महाराष्ट्र और बिहार के पीछे असली डेटा है। शुल्क केंद्रीय अनुसूची के अनुसार हैं और हर राज्य के लिए अलग तालिका चाहिए होगी। अभ्यास बैंक में नौ दक्षताओं पर चालीस स्थितियाँ हैं, पूरा आधिकारिक प्रश्न बैंक नहीं। ड्राइविंग लाइसेंस विज़ार्ड माँगने पर अपनी 30 दिन की प्रतीक्षा अवधि छोड़ देता है, क्योंकि डेमो एक महीना इंतज़ार नहीं कर सकता।',
      },
    ],
  },
  a11y: {
    t: 'Accessibility', tHi: 'सुगम्यता', body: [
      {
        h: 'Built in', hHi: 'जो बना हुआ है',
        // Two claims here used to be untrue, which on this panel of all panels
        // is the worst kind of error: Marathi was named in a picker that offers
        // only two languages, and "every tap target at least 44px" was written
        // over an interface where most controls are 40px and the footer's links
        // are 22. Both now say what is actually measurable, and the shortfall
        // moved down to "Still missing" rather than being softened away.
        p: 'Text size control and a light/dark theme in the header. A language switcher (English and Hindi). Buttons and form controls are at least 40px tall. Visible focus rings on every control. Colour never carries meaning alone — a state always has a label or an icon too. Contrast checked against WCAG AA. Practice-game hearts and round outcomes are announced to screen readers, not just shown visually, and its sound cues can be muted.',
        pHi: 'हेडर में टेक्स्ट का आकार बदलने का नियंत्रण और हल्की/गहरी थीम। भाषा बदलने का विकल्प (अंग्रेज़ी और हिंदी)। बटन और फ़ॉर्म नियंत्रण कम से कम 40px ऊँचे हैं। हर नियंत्रण पर दिखने वाला फोकस रिंग। रंग अकेले कभी अर्थ नहीं बताता — हर स्थिति के साथ लेबल या आइकन भी होता है। कंट्रास्ट WCAG AA के अनुसार जाँचा गया। अभ्यास खेल के दिल और हर दौर का नतीजा स्क्रीन रीडर को बोलकर बताया जाता है, सिर्फ दिखाया नहीं जाता, और उसकी आवाज़ें बंद की जा सकती हैं।',
      },
      {
        h: 'For low digital literacy', hHi: 'कम डिजिटल जानकारी वालों के लिए',
        p: 'One decision per screen, plain language instead of statute, no jargon without an explanation next to it, and the practice game readable aloud by the browser.',
        pHi: 'हर स्क्रीन पर एक ही फैसला, कानूनी भाषा की जगह सरल भाषा, बिना साथ में समझाए कोई तकनीकी शब्द नहीं, और अभ्यास खेल जिसे ब्राउज़र पढ़कर सुना सकता है।',
      },
      {
        h: 'Still missing', hHi: 'अभी क्या बाकी है',
        p: 'A screen-reader pass beyond the basics above — landmark regions and skip links have not been added. Footer and inline text links are below the 44px touch target the buttons aim for. Marathi is written through much of the interface but is not offered in the picker yet, because it is not finished. The DL wizard and the report card coaching text are still English-only.',
        pHi: 'ऊपर बताई बुनियादी बातों से आगे स्क्रीन रीडर की पूरी जाँच — लैंडमार्क क्षेत्र और स्किप लिंक अभी नहीं जोड़े गए। फुटर और वाक्य के भीतर के लिंक 44px के उस टच लक्ष्य से छोटे हैं जिसे बटन पूरा करते हैं। मराठी इंटरफ़ेस में काफ़ी जगह लिखी जा चुकी है पर अभी पिकर में नहीं दी गई, क्योंकि वह पूरी नहीं हुई। डीएल विज़ार्ड और रिपोर्ट कार्ड का मार्गदर्शन अभी सिर्फ अंग्रेज़ी में है।',
      },
    ],
  },
  source: {
    t: 'Source and honesty', tHi: 'स्रोत और ईमानदारी', body: [
      {
        h: 'Status', hHi: 'स्थिति',
        p: 'A design prototype, not a government product. No official emblem or logo is used, and nothing here implies approval or partnership.',
        pHi: 'यह एक डिज़ाइन प्रोटोटाइप है, सरकारी उत्पाद नहीं। कोई आधिकारिक प्रतीक या लोगो इस्तेमाल नहीं किया गया, और यहाँ कुछ भी अनुमोदन या साझेदारी का संकेत नहीं देता।',
      },
      {
        h: 'Data', hHi: 'डेटा',
        p: 'All names, numbers, documents, receipts and licences are synthetic. The road-rule content is written from the Motor Vehicles Act, the Central Motor Vehicles Rules and published state question banks.',
        pHi: 'सभी नाम, संख्याएँ, दस्तावेज़, रसीदें और लाइसेंस काल्पनिक हैं। सड़क नियमों की सामग्री मोटर वाहन अधिनियम, केंद्रीय मोटर वाहन नियम और प्रकाशित राज्य प्रश्न बैंकों से लिखी गई है।',
      },
      {
        h: 'Not done', hHi: 'जो नहीं किया गया',
        p: 'No live government system was accessed, tested or interfered with. No private API was reverse-engineered. No personal or restricted data was scraped.',
        pHi: 'किसी जीवित सरकारी सिस्टम तक न पहुँच बनाई गई, न उसे जाँचा गया, न उसमें दखल दिया गया। किसी निजी एपीआई की रिवर्स-इंजीनियरिंग नहीं की गई। कोई निजी या प्रतिबंधित जानकारी नहीं खंगाली गई।',
      },
    ],
  },
};
