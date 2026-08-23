import { scenariosFor, spelledOut, vehicleFocusFrom } from './scenarios';
import { useT } from '../lib/language';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';

/** Each section: [heading-en, heading-hi, heading-mr, points], each point itself [en, hi, mr]. */
const SECTIONS: [string, string, string, [string, string, string][]][] = [
  ['Signals & priority', 'संकेत और प्राथमिकता', 'सिग्नल आणि प्राधान्य', [
    ['Red means stop completely. Amber means stop unless stopping suddenly would itself be unsafe. Green means go only if the way ahead is actually clear.',
      'लाल का मतलब पूरी तरह रुकना है। एम्बर का मतलब है रुकना, जब तक अचानक रुकना खुद असुरक्षित न हो। हरे का मतलब है चलना, केवल तब जब आगे का रास्ता वास्तव में साफ हो।',
      'लाल म्हणजे पूर्णपणे थांबणे. एम्बर म्हणजे थांबणे, जोपर्यंत अचानक थांबणे स्वतःच असुरक्षित नाही. हरवा म्हणजे जाणे, फक्त जेव्हा पुढचा रस्ता खरोखर रिकामा असेल.'],
    ['At a junction with no signal and no sign, traffic coming from your right always goes first.',
      'बिना सिग्नल और बिना संकेत वाले चौराहे पर, आपके दाईं ओर से आने वाला ट्रैफिक हमेशा पहले जाता है।',
      'सिग्नल आणि चिन्ह नसलेल्या चौकात, तुमच्या उजवीकडून येणारी वाहतूक नेहमी आधी जाते.'],
    ['On a roundabout, traffic already on the roundabout has priority over traffic entering it.',
      'गोल चक्कर (राउंडअबाउट) पर, पहले से चक्कर में मौजूद ट्रैफिक को उसमें प्रवेश करने वाले ट्रैफिक पर प्राथमिकता मिलती है।',
      'गोल चक्करावर, आधीच चक्करात असलेल्या वाहतुकीला त्यात प्रवेश करणाऱ्या वाहतुकीपेक्षा प्राधान्य असते.'],
    ['A pedestrian already on a zebra crossing has priority over every vehicle, whatever your own signal shows.',
      'ज़ेब्रा क्रॉसिंग पर पहले से मौजूद पैदल यात्री को हर वाहन पर प्राथमिकता मिलती है, आपका सिग्नल जो भी दिखाए।',
      'झेब्रा क्रॉसिंगवर आधीच असलेल्या पादचाऱ्याला प्रत्येक वाहनापेक्षा प्राधान्य असते, तुमचा सिग्नल काहीही दाखवत असला तरी.'],
    ['Always give way to an ambulance, fire engine or police vehicle running with its siren or flasher on — pull left and stop if needed.',
      'सायरन या फ्लैशर के साथ चल रही एम्बुलेंस, फायर इंजन या पुलिस वाहन को हमेशा रास्ता दें — ज़रूरत हो तो बाईं ओर जाकर रुक जाएं।',
      'सायरन किंवा फ्लॅशर सुरू असलेल्या रुग्णवाहिका, अग्निशमन वाहन किंवा पोलीस वाहनाला नेहमी वाट द्या — गरज असल्यास डावीकडे जाऊन थांबा.'],
  ]],
  ['Road signs, by shape', 'आकार के अनुसार सड़क संकेत', 'आकारानुसार रस्ता चिन्हे', [
    ['A triangle warns you of something ahead. It never gives an order.',
      'त्रिभुज आपको आगे किसी चीज़ के बारे में चेतावनी देता है। यह कभी आदेश नहीं देता।',
      'त्रिकोण तुम्हाला पुढे काहीतरी असल्याचा इशारा देतो. तो कधीही आदेश देत नाही.'],
    ['A circle gives an order or a prohibition — obeying it is mandatory, not advisory.',
      'वृत्त एक आदेश या प्रतिबंध देता है — इसका पालन करना अनिवार्य है, सलाह नहीं।',
      'वर्तुळ एक आदेश किंवा प्रतिबंध देते — त्याचे पालन करणे सक्तीचे आहे, सल्ला नाही.'],
    ['A rectangle informs you — distances, facilities, place names.',
      'आयत आपको सूचित करता है — दूरियां, सुविधाएं, स्थानों के नाम।',
      'आयत तुम्हाला माहिती देतो — अंतर, सुविधा, ठिकाणांची नावे.'],
    ["The ones you'll see constantly: STOP (red octagon), No entry (red circle, white bar), a numbered speed limit (red-ringed circle), No parking (blue circle, red cross), One way (blue rectangle with an arrow), No horn, School ahead, Hospital ahead, a compulsory turn arrow, and Give way (an inverted triangle).",
      'जो आप बार-बार देखेंगे: STOP (लाल अष्टकोण), प्रवेश निषेध (लाल वृत्त, सफेद पट्टी), गति सीमा अंक वाला (लाल घेरे वाला वृत्त), No Parking (नीला वृत्त, लाल क्रॉस), वन वे (तीर वाला नीला आयत), No Horn, आगे स्कूल, आगे अस्पताल, अनिवार्य मुड़ने का तीर, और Give Way (उल्टा त्रिभुज)।',
      'जे तुम्हाला सतत दिसतील: STOP (लाल अष्टकोन), प्रवेश बंद (लाल वर्तुळ, पांढरी पट्टी), वेग मर्यादा आकडा असलेले (लाल कडा असलेले वर्तुळ), No Parking (निळे वर्तुळ, लाल क्रॉस), वन वे (बाणासह निळा आयत), No Horn, पुढे शाळा, पुढे रुग्णालय, सक्तीचे वळण दाखवणारा बाण, आणि Give Way (उलटा त्रिकोण).'],
  ]],
  ['Road markings', 'सड़क चिह्न', 'रस्ता खुणा', [
    ['A solid centre line must never be crossed to overtake.',
      'ओवरटेक करने के लिए ठोस मध्य रेखा को कभी पार नहीं करना चाहिए।',
      'ओव्हरटेक करण्यासाठी ठोस मध्य रेषा कधीही ओलांडू नये.'],
    ['A broken centre line allows overtaking, but only when the road ahead is clearly visible and safe.',
      'टूटी हुई मध्य रेखा ओवरटेक करने की अनुमति देती है, लेकिन केवल तब जब आगे का रास्ता साफ दिखे और सुरक्षित हो।',
      'तुटलेली मध्य रेषा ओव्हरटेक करण्याची परवानगी देते, पण फक्त जेव्हा पुढचा रस्ता स्पष्ट दिसतो आणि सुरक्षित असतो.'],
    ['A zebra crossing means pedestrians have the right of way — stop before it, never on it.',
      'ज़ेब्रा क्रॉसिंग का मतलब है पैदल यात्रियों को रास्ते का अधिकार है — इससे पहले रुकें, इसके ऊपर कभी नहीं।',
      'झेब्रा क्रॉसिंग म्हणजे पादचाऱ्यांना रस्त्याचा हक्क आहे — त्याच्या आधी थांबा, त्यावर कधीही नाही.'],
    ['A stop line at a signal or junction is exactly where you stop — not the crossing itself, not past it.',
      'सिग्नल या चौराहे पर स्टॉप लाइन ठीक वही जगह है जहां आपको रुकना है — क्रॉसिंग पर नहीं, उससे आगे भी नहीं।',
      'सिग्नल किंवा चौकातील स्टॉप लाईन म्हणजे नेमकी तीच जागा जिथे तुम्ही थांबायचे आहे — क्रॉसिंगवर नाही, त्याच्या पुढेही नाही.'],
    ['Yellow-and-black diagonal stripes before a hump or speed breaker are a warning to slow down now, not at the hump itself — by then it is too late to matter.',
      'गति अवरोधक (स्पीड ब्रेकर) से पहले पीली-काली तिरछी पट्टियां अभी धीमे होने की चेतावनी हैं, अवरोधक पर नहीं — तब तक देर हो चुकी होती है।',
      'स्पीड ब्रेकरच्या आधीच्या पिवळ्या-काळ्या तिरप्या रेषा आताच वेग कमी करण्याचा इशारा आहेत, ब्रेकरवर नाही — तोपर्यंत उशीर झालेला असतो.'],
  ]],
  ['Hazards you actually meet on Indian roads', 'भारतीय सड़कों पर वास्तव में मिलने वाले खतरे', 'भारतीय रस्त्यांवर प्रत्यक्षात भेटणारे धोके', [
    ['Pedestrians step into moving traffic outside marked crossings more often than any manual admits — slow down near markets, bus stops and schools regardless of who technically has right of way.',
      'पैदल यात्री चिह्नित क्रॉसिंग के बाहर भी चलते ट्रैफिक में आ जाते हैं, जितना कोई मैनुअल मानता है उससे कहीं ज़्यादा बार — बाज़ारों, बस स्टॉप और स्कूलों के पास धीमे हो जाएं, चाहे तकनीकी रूप से रास्ते का अधिकार किसी का भी हो।',
      'पादचारी चिन्हांकित क्रॉसिंगबाहेरही धावत्या वाहतुकीत येतात, कोणत्याही पुस्तकात मान्य केले जाते त्यापेक्षा जास्त वेळा — बाजार, बस स्टॉप आणि शाळांजवळ वेग कमी करा, तांत्रिकदृष्ट्या रस्त्याचा हक्क कोणाचाही असो.'],
    ['Two-wheelers weave between lanes and undertake from the left. Check mirrors and your blind spot before every lane change, not only before a turn.',
      'दोपहिया वाहन लेन के बीच बुनते हैं और बाईं ओर से आगे निकल जाते हैं। हर लेन बदलने से पहले मिरर और ब्लाइंड स्पॉट जांचें, केवल मुड़ने से पहले नहीं।',
      'दुचाकी वाहने लेनच्या मध्ये विणतात आणि डावीकडून पुढे जातात. प्रत्येक लेन बदलण्यापूर्वी मिरर आणि ब्लाइंड स्पॉट तपासा, फक्त वळण्यापूर्वी नाही.'],
    ['Stray animals on the carriageway are common outside cities. Slow down; do not swerve sharply.',
      'शहरों के बाहर सड़क पर आवारा जानवर आम हैं। धीमे हो जाएं; अचानक मोड़ न लें।',
      'शहरांबाहेर रस्त्यावर मोकाट जनावरे सामान्य आहेत. वेग कमी करा; अचानक वळू नका.'],
    ['A stopped or slow-moving bus or truck ahead usually means something — a pothole, a pedestrian, an animal — is hidden just past it. Do not overtake blind.',
      'आगे रुकी हुई या धीमी बस या ट्रक का आम मतलब है कि उसके ठीक बाद कुछ — गड्ढा, पैदल यात्री, जानवर — छिपा है। बिना देखे ओवरटेक न करें।',
      'पुढे थांबलेली किंवा हळू चालणारी बस किंवा ट्रक म्हणजे साधारणपणे तिच्यामागे काहीतरी — खड्डा, पादचारी, जनावर — लपलेले असते. न पाहता ओव्हरटेक करू नका.'],
    ["Assume any parked car's door could open without warning, and any side street could send out a vehicle that never actually stops first.",
      'मान लें कि किसी भी खड़ी कार का दरवाज़ा बिना चेतावनी खुल सकता है, और कोई भी गली से कोई वाहन बिना रुके निकल सकता है।',
      'गृहीत धरा की कोणत्याही उभ्या कारचा दरवाजा इशाऱ्याशिवाय उघडू शकतो, आणि कोणत्याही गल्लीतून कोणतेही वाहन न थांबता बाहेर येऊ शकते.'],
  ]],
  ['Documents to carry', 'साथ रखने वाले दस्तावेज़', 'सोबत ठेवायची कागदपत्रे', [
    ['Your driving licence, valid for the class of vehicle you are driving.',
      'आपका ड्राइविंग लाइसेंस, उस श्रेणी के वाहन के लिए वैध जिसे आप चला रहे हैं।',
      'तुमचे ड्रायव्हिंग लायसन्स, तुम्ही चालवत असलेल्या वाहन वर्गासाठी वैध.'],
    ["The vehicle's Registration Certificate (RC).",
      'वाहन का रजिस्ट्रेशन सर्टिफिकेट (RC)।',
      'वाहनाचे नोंदणी प्रमाणपत्र (RC).'],
    ['A current insurance policy — third-party cover is the legal minimum.',
      'एक चालू बीमा पॉलिसी — थर्ड-पार्टी कवर कानूनी न्यूनतम है।',
      'एक चालू विमा पॉलिसी — थर्ड-पार्टी कव्हर ही कायदेशीर किमान अट आहे.'],
    ['A valid Pollution Under Control (PUC) certificate.',
      'एक वैध प्रदूषण नियंत्रण (PUC) प्रमाणपत्र।',
      'एक वैध प्रदूषण नियंत्रण (PUC) प्रमाणपत्र.'],
    ["A physical copy or a DigiLocker digital copy both count as legally valid — you don't need to carry paper specifically.",
      'एक भौतिक प्रति या डिजिलॉकर की डिजिटल प्रति, दोनों कानूनी रूप से मान्य हैं — आपको खास तौर पर कागज़ साथ रखने की ज़रूरत नहीं।',
      'एक प्रत्यक्ष प्रत किंवा डिजिलॉकरची डिजिटल प्रत, दोन्ही कायदेशीररित्या वैध आहेत — तुम्हाला खास कागद सोबत ठेवायची गरज नाही.'],
    ["As a learner specifically: an 'L' sign displayed on the vehicle, and a licence holder of that class seated beside you.",
      "लर्नर के रूप में खास तौर पर: वाहन पर 'L' चिह्न लगा हो, और उस श्रेणी का लाइसेंस धारक आपके बगल में बैठा हो।",
      "लर्नर म्हणून खास: वाहनावर 'L' चिन्ह लावलेले असावे, आणि त्या वर्गाचा लायसन्सधारक तुमच्या शेजारी बसलेला असावा."],
  ]],
  ['Safety rules that are also the law', 'सुरक्षा नियम जो कानून भी हैं', 'सुरक्षा नियम जे कायदाही आहेत', [
    ['Helmets are compulsory for both the rider and the pillion on a two-wheeler.',
      'दोपहिया वाहन पर चालक और पीछे बैठने वाले दोनों के लिए हेलमेट अनिवार्य है।',
      'दुचाकीवर चालक आणि मागे बसणारी व्यक्ती दोघांसाठी हेल्मेट सक्तीचे आहे.'],
    ['Seatbelts are compulsory for the driver and every passenger in a car — front seat and back.',
      'कार में चालक और हर यात्री के लिए सीटबेल्ट अनिवार्य है — आगे और पीछे दोनों सीटों पर।',
      'कारमध्ये चालक आणि प्रत्येक प्रवाशासाठी सीटबेल्ट सक्तीचे आहे — पुढच्या आणि मागच्या दोन्ही सीटवर.'],
    ['Using a hand-held phone while driving is an offence, hands-free or not. Pull over if a call matters that much.',
      'गाड़ी चलाते समय हाथ में फोन इस्तेमाल करना अपराध है, हैंड्स-फ़्री हो या न हो। अगर कॉल इतनी ज़रूरी है तो गाड़ी किनारे रोकें।',
      'गाडी चालवताना हातात फोन वापरणे हा अपराध आहे, हँड्स-फ्री असो वा नसो. कॉल इतका महत्त्वाचा असेल तर गाडी बाजूला थांबवा.'],
    ['Drink-driving is effectively zero-tolerance in enforcement, whatever the exact legal limit says on paper.',
      'शराब पीकर गाड़ी चलाना व्यावहारिक रूप से शून्य-सहनशीलता का मामला है, कानूनी सीमा कागज़ पर जो भी कहे।',
      'दारू पिऊन गाडी चालवणे हे व्यवहारात शून्य-सहनशीलतेचे प्रकरण आहे, कायदेशीर मर्यादा कागदावर काहीही म्हणत असली तरी.'],
    ['Speed limits vary by vehicle class and road type (city road, highway, expressway) and are enforced by camera at least as often as by an officer standing there.',
      'गति सीमा वाहन श्रेणी और सड़क के प्रकार (शहर की सड़क, हाईवे, एक्सप्रेसवे) के अनुसार बदलती है, और इसे कैमरे से उतनी ही बार लागू किया जाता है जितना खड़े अधिकारी से।',
      'वेग मर्यादा वाहन वर्ग आणि रस्त्याच्या प्रकारानुसार (शहरी रस्ता, हायवे, एक्सप्रेसवे) बदलते, आणि ती उभ्या अधिकाऱ्याइतक्याच वेळा कॅमेऱ्याने अंमलात आणली जाते.'],
  ]],
  ['Courtesy that actually keeps traffic moving', 'सौजन्य जो वास्तव में ट्रैफिक चलाता रहता है', 'सौजन्य जे प्रत्यक्षात वाहतूक सुरळीत ठेवते', [
    ["Indicate before you turn or change lane — not while you're already doing it.",
      'मुड़ने या लेन बदलने से पहले इंडिकेटर दें — यह करते समय नहीं।',
      'वळण्यापूर्वी किंवा लेन बदलण्यापूर्वी इंडिकेटर द्या — ते करताना नाही.'],
    ['Check your mirrors before every manoeuvre. Indian traffic rarely warns you with a horn first.',
      'हर पैंतरे से पहले अपने मिरर देखें। भारतीय ट्रैफिक शायद ही पहले हॉर्न से चेतावनी देता है।',
      'प्रत्येक हालचालीपूर्वी तुमचे मिरर पहा. भारतीय वाहतूक क्वचितच आधी हॉर्नने इशारा देते.'],
    ['Keep a following distance you could actually stop within, not the distance the vehicle ahead happens to leave you.',
      'ऐसी अनुगमन दूरी रखें जिसमें आप वास्तव में रुक सकें, न कि वह दूरी जो आगे वाला वाहन आपको छोड़ता है।',
      'अशी पाठलाग अंतर ठेवा ज्यात तुम्ही खरोखर थांबू शकाल, पुढच्या वाहनाने सोडलेले अंतर नाही.'],
    ['Overtake only from the right, and only when the lane you are moving into is genuinely clear both ways.',
      'केवल दाईं ओर से ओवरटेक करें, और केवल तब जब जिस लेन में आप जा रहे हैं वह दोनों तरफ से वास्तव में साफ हो।',
      'फक्त उजवीकडून ओव्हरटेक करा, आणि फक्त जेव्हा तुम्ही जात असलेली लेन दोन्ही बाजूंनी खरोखर रिकामी असेल.'],
    ['Use your horn to warn, not to vent. Dip your headlights for oncoming traffic at night, every time.',
      'हॉर्न का इस्तेमाल चेतावनी देने के लिए करें, गुस्सा निकालने के लिए नहीं। रात में सामने से आ रहे ट्रैफिक के लिए हर बार हेडलाइट डिप करें।',
      'हॉर्नचा वापर इशारा देण्यासाठी करा, राग काढण्यासाठी नाही. रात्री समोरून येणाऱ्या वाहतुकीसाठी दरवेळी हेडलाइट डिप करा.'],
  ]],
  ['Situations with their own rules', 'अपने खुद के नियमों वाली स्थितियां', 'स्वतःचे नियम असलेली परिस्थिती', [
    ['At a level crossing: stop, look, and never try to beat a closing gate. A stalled engine on the tracks is the one mistake with no second chance.',
      'रेलवे क्रॉसिंग पर: रुकें, देखें, और बंद होते गेट को कभी पार करने की कोशिश न करें। पटरी पर इंजन बंद हो जाना वह एक गलती है जिसमें दूसरा मौका नहीं मिलता।',
      'रेल्वे क्रॉसिंगवर: थांबा, पहा, आणि बंद होणारे गेट ओलांडण्याचा प्रयत्न कधीही करू नका. रुळावर इंजिन बंद पडणे ही एक चूक आहे जिला दुसरी संधी नाही.'],
    ["In a school or hospital zone, the lower posted speed limit is there for a reason that shouldn't need repeating.",
      'स्कूल या अस्पताल क्षेत्र में, कम गति सीमा एक ऐसी वजह से है जिसे दोहराने की ज़रूरत नहीं होनी चाहिए।',
      'शाळा किंवा रुग्णालय परिसरात, कमी वेग मर्यादा अशा कारणासाठी आहे ज्याची पुनरावृत्ती करण्याची गरज नसावी.'],
    ['In rain or fog: headlights on (not high beam in fog), following distance doubled, speed down — visibility and braking distance both work against you at the same time.',
      'बारिश या कोहरे में: हेडलाइट जलाएं (कोहरे में हाई बीम नहीं), अनुगमन दूरी दोगुनी करें, गति कम करें — दृश्यता और ब्रेकिंग दूरी दोनों एक साथ आपके खिलाफ काम करती हैं।',
      'पाऊस किंवा धुक्यात: हेडलाइट लावा (धुक्यात हाय बीम नाही), पाठलाग अंतर दुप्पट करा, वेग कमी करा — दृश्यमानता आणि ब्रेकिंग अंतर दोन्ही एकाच वेळी तुमच्याविरुद्ध काम करतात.'],
    ['On a highway: keep to the left unless overtaking, and move back left once you have. Lane discipline is what most multi-vehicle pile-ups are actually about.',
      'हाईवे पर: ओवरटेक न कर रहे हों तो बाईं ओर रहें, और ओवरटेक करने के बाद वापस बाईं ओर आ जाएं। ज़्यादातर बहु-वाहन दुर्घटनाएं वास्तव में लेन अनुशासन की कमी से होती हैं।',
      'हायवेवर: ओव्हरटेक करत नसाल तर डावीकडे राहा, आणि ओव्हरटेक केल्यानंतर पुन्हा डावीकडे या. बहुतेक बहु-वाहन अपघात हे प्रत्यक्षात लेन शिस्तीच्या अभावामुळेच होतात.'],
  ]],
];

/** Comprehensive road-rules primer shown before the scored practice game — untimed, unscored, meant to be read once. */
export function Learn({ go, state }: PageProps) {
  const t = useT();
  const vehicleFocus = vehicleFocusFrom(state);
  const total = scenariosFor(vehicleFocus).length;

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('learn')}>{Icon.left()} {t('Back', 'पीछे', 'मागे')}</button>
      <div className="col g10" style={{ marginBottom: 24 }}>
        <span className="eyebrow">{t('Before you play', 'खेलने से पहले', 'खेळण्यापूर्वी')}</span>
        <h1>{t('Everything worth knowing before you drive in India', 'भारत में गाड़ी चलाने से पहले जानने योग्य सब कुछ', 'भारतात गाडी चालवण्यापूर्वी जाणून घेण्यासारखे सर्व काही')}</h1>
        <p className="lede">{t('Not a memory test — read this once, in your own time, with no clock running. The game that follows tests the same ground under a four-second countdown, which is the part that actually needs practice.', 'यह याददाश्त की परीक्षा नहीं है — इसे एक बार, अपनी गति से, बिना किसी घड़ी के पढ़ें। इसके बाद वाला खेल इसी सामग्री की परीक्षा चार सेकंड की उलटी गिनती में लेता है, जिसका अभ्यास वास्तव में ज़रूरी है।', 'ही स्मरणशक्तीची परीक्षा नाही — हे एकदा, तुमच्या स्वतःच्या वेगाने, कोणतेही घड्याळ न लावता वाचा. यानंतरचा खेळ हीच सामग्री चार सेकंडांच्या उलट मोजणीत तपासतो, ज्याचा सराव खरोखर आवश्यक आहे.')}</p>
      </div>
      <div className="col g12">
        {SECTIONS.map(([heading, headingHi, headingMr, points], i) => (
          <details key={heading} className="flat" open={i === 0} style={{ padding: '16px 20px' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>{t(heading, headingHi, headingMr)}</summary>
            <ul style={{ marginTop: 12, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {points.map((point, j) => <li key={j} className="sub" style={{ lineHeight: 1.6 }}>{t(...point)}</li>)}
            </ul>
          </details>
        ))}
      </div>
      <div className="sticky-cta"><div className="row g12 wrapf">
        <button className="btn btn-p" onClick={() => go('game')}>{t('Start the test', 'टेस्ट शुरू करें', 'टेस्ट सुरू करा')} · {spelledOut(total).replace(/^./, c => c.toUpperCase())} {t('situations', 'स्थितियां', 'परिस्थिती')} {Icon.right()}</button>
        <button className="btn btn-s" onClick={() => go('game')}>{t('Skip — I already know this', 'छोड़ें — मैं यह पहले से जानता/जानती हूं', 'वगळा — मला हे आधीच माहीत आहे')}</button>
      </div></div>
      <div style={{ height: 48 }} />
    </div>
  );
}
