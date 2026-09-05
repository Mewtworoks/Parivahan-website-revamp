import { useState } from 'react';
import { useT } from '../lib/language';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note } from '../ui/SharedUI';

const TUTORIAL_ITEMS: [heading: string, body: string, headingHi: string, bodyHi: string, headingMr: string, bodyMr: string][] = [
  ['Signals and priority', 'Yellow means stop unless stopping is unsafe. At an unmarked junction, traffic from your right goes first. A pedestrian already on a zebra crossing goes before you, whatever your light says.',
    'संकेत और प्राथमिकता', 'पीली बत्ती का मतलब है रुकें, जब तक रुकना असुरक्षित न हो। बिना चिह्नित चौराहे पर, आपके दाईं ओर से आने वाला ट्रैफिक पहले जाता है। ज़ेब्रा क्रॉसिंग पर पहले से मौजूद पैदल यात्री आपसे पहले जाता है, आपकी लाइट जो भी कहे।',
    'सिग्नल आणि प्राधान्य', 'पिवळ्या दिव्याचा अर्थ थांबा, जोपर्यंत थांबणे असुरक्षित नाही. चिन्हांकित नसलेल्या चौकात, तुमच्या उजवीकडून येणारी वाहतूक आधी जाते. झेब्रा क्रॉसिंगवर आधीच असलेला पादचारी तुमच्याआधी जातो, तुमचा सिग्नल काहीही सांगत असला तरी.'],
  ['Hazards you cannot see yet', 'Slow down before a parked van, a stopped bus or a blind bend — not after something appears. Most learner failures are about reacting late, not about not knowing the rule.',
    'खतरे जो आप अभी नहीं देख सकते', 'खड़ी वैन, रुकी हुई बस या अंधे मोड़ से पहले धीमे हो जाएं — कुछ दिखने के बाद नहीं। ज़्यादातर लर्नर की असफलता देर से प्रतिक्रिया देने की वजह से होती है, नियम न जानने की वजह से नहीं।',
    'तुम्हाला अजून न दिसणारे धोके', 'उभी असलेली व्हॅन, थांबलेली बस किंवा आडवळणापूर्वी वेग कमी करा — काहीतरी दिसल्यानंतर नाही. बहुतेक लर्नरचे अपयश उशिरा प्रतिक्रिया देण्यामुळे असते, नियम माहीत नसल्यामुळे नाही.'],
  ['Signs by shape', 'A triangle warns you. A circle orders or prohibits you. A rectangle informs you. Learn the three shapes and half the sign questions answer themselves.',
    'आकार के अनुसार संकेत', 'त्रिभुज आपको चेतावनी देता है। वृत्त आपको आदेश देता है या रोकता है। आयत आपको सूचित करता है। तीन आकार सीख लें और आधे संकेत सवाल खुद ही हल हो जाते हैं।',
    'आकारानुसार चिन्हे', 'त्रिकोण तुम्हाला इशारा देतो. वर्तुळ तुम्हाला आदेश देतो किंवा थांबवतो. आयत तुम्हाला माहिती देतो. तीन आकार शिकून घ्या आणि निम्मे चिन्ह प्रश्न स्वतःच सुटतात.'],
  ['Markings', 'A solid centre line must not be crossed. A broken line allows overtaking when the road ahead is clear. Most people have this the wrong way round.',
    'चिह्न', 'ठोस मध्य रेखा को पार नहीं करना चाहिए। टूटी रेखा तब ओवरटेकिंग की अनुमति देती है जब आगे की सड़क साफ हो। ज़्यादातर लोग इसे उल्टा समझते हैं।',
    'खुणा', 'ठोस मध्य रेषा ओलांडू नये. तुटलेली रेषा पुढचा रस्ता रिकामा असल्यास ओव्हरटेकिंगची परवानगी देते. बहुतेक लोक हे उलटे समजतात.'],
  ["What a learner must carry", "Your learner's licence, an L plate on the vehicle, and for most classes a licensed holder of that class beside you. Riding without them is an offence even with a valid LL.",
    'लर्नर को क्या साथ रखना चाहिए', 'आपका लर्नर लाइसेंस, वाहन पर एक L प्लेट, और ज़्यादातर श्रेणियों के लिए उस श्रेणी का लाइसेंस धारक आपके साथ। इनके बिना चलाना, वैध LL होने पर भी, एक अपराध है।',
    'लर्नरने काय सोबत ठेवावे', 'तुमचे लर्नर लायसन्स, वाहनावर एक L पाटी, आणि बहुतेक वर्गांसाठी त्या वर्गाचा लायसन्सधारक तुमच्यासोबत. वैध LL असतानाही यांशिवाय चालवणे हा अपराध आहे.'],
];

/** Mandatory road-safety tutorial gate before the theory test. */
export function Tutorial({ go, state }: PageProps) {
  const t = useT();
  const isAadhaar = state.form?.route === 'aadhaar';
  const [read, setRead] = useState<Record<number, boolean>>({});
  const allRead = TUTORIAL_ITEMS.every((_, i) => read[i]);

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g10" style={{ marginBottom: 24 }}>
        <div className="row between g12 wrapf">
          <span className="eyebrow">{t('Before stage 7 · mandatory', 'चरण 7 से पहले · अनिवार्य', 'टप्पा 7 पूर्वी · अनिवार्य')}</span>
          {/* Demo shortcut, same as the wizard's. Ticking five items in front of
              an audience shows nothing the build is arguing, and until they are
              all ticked both onward buttons stay disabled. */}
          {!allRead && (
            <button className="btn btn-g btn-sm" onClick={() => setRead(Object.fromEntries(TUTORIAL_ITEMS.map((_, i) => [i, true])))}>
              {Icon.play()} {t('Mark read for demo', 'डेमो के लिए पढ़ा हुआ चिह्नित करें')}
            </button>
          )}
        </div>
        <h1>{t('Road safety tutorial', 'सड़क सुरक्षा ट्यूटोरियल', 'रस्ता सुरक्षा ट्यूटोरियल')}</h1>
        <p className="lede">{t('Watching this is mandatory, and in some states you have already paid a road safety fee for it. The official portal links a video most people leave playing in another tab. This is the same content as five things you can read in two minutes, ticked off as you go.', 'इसे देखना अनिवार्य है, और कुछ राज्यों में आप इसके लिए सड़क सुरक्षा शुल्क पहले ही चुका चुके हैं। आधिकारिक पोर्टल एक वीडियो लिंक करता है जिसे ज़्यादातर लोग दूसरे टैब में चलता छोड़ देते हैं। यह वही सामग्री है, पांच बातों के रूप में जिन्हें आप दो मिनट में पढ़ सकते हैं, पढ़ते ही टिक करते जाएं।', 'हे पाहणे सक्तीचे आहे, आणि काही राज्यांत तुम्ही यासाठी रस्ता सुरक्षा शुल्क आधीच भरले आहे. अधिकृत पोर्टल एक व्हिडिओ जोडते जो बहुतेक लोक दुसऱ्या टॅबमध्ये चालू ठेवतात. हीच सामग्री आहे, पाच गोष्टींच्या रूपात ज्या तुम्ही दोन मिनिटांत वाचू शकता, वाचताच टिक करा.')}</p>
      </div>
      <div className="card card-p col g12">
        {TUTORIAL_ITEMS.map(([heading, body, headingHi, bodyHi, headingMr, bodyMr], i) => (
          <button key={heading} className="tile" role="checkbox" aria-checked={!!read[i]} onClick={() => setRead({ ...read, [i]: !read[i] })}>
            <span className="tick" style={{ borderRadius: 6 }}>{read[i] ? Icon.check() : null}</span>
            <span className="col g6 grow"><b style={{ fontWeight: 600 }}>{t(heading, headingHi, headingMr)}</b><span className="sub" style={{ lineHeight: 1.55 }}>{t(body, bodyHi, bodyMr)}</span></span>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        {allRead && <div className="fade" style={{ marginBottom: 12 }}><Note tone="ok" icon={Icon.check()}>{t('Tutorial complete.', 'ट्यूटोरियल पूर्ण।', 'ट्यूटोरियल पूर्ण.')} {t('Recorded against your application, so nobody can ask you to watch it again.', 'आपके आवेदन के साथ दर्ज किया गया, इसलिए कोई आपसे इसे फिर देखने को नहीं कह सकता।', 'तुमच्या अर्जासोबत नोंदवले, त्यामुळे कोणीही तुम्हाला ते पुन्हा पाहण्यास सांगू शकत नाही.')}</Note></div>}
        <Note tone={isAadhaar ? 'brand' : undefined}>{isAadhaar
          ? <span>{t('Your test password will arrive by SMS', 'आपका टेस्ट पासवर्ड SMS से आएगा', 'तुमचा टेस्ट पासवर्ड SMS ने येईल')} {t('to the mobile registered against your Aadhaar. You can take the ten-question test from home, and download the licence the moment you pass.', 'आपके आधार से जुड़े मोबाइल पर। आप दस सवालों वाला टेस्ट घर से दे सकते हैं, और पास होने पर तुरंत लाइसेंस डाउनलोड कर सकते हैं।', 'तुमच्या आधारशी जोडलेल्या मोबाइलवर. तुम्ही दहा प्रश्नांची टेस्ट घरून देऊ शकता, आणि उत्तीर्ण झाल्यावर लगेच लायसन्स डाउनलोड करू शकता.')}</span>
          : <span>{t('You will take the test at the office on your appointment day. Practising here first means you walk in knowing the format.', 'आप अपने अपॉइंटमेंट के दिन कार्यालय में टेस्ट देंगे। यहां पहले अभ्यास करने का मतलब है कि आप फॉर्मेट जानकर जाते हैं।', 'तुम्ही तुमच्या अपॉइंटमेंटच्या दिवशी कार्यालयात टेस्ट देणार आहात. इथे आधी सराव करण्याचा अर्थ आहे की तुम्ही स्वरूप जाणून जाता.')}</span>}</Note>
      </div>
      <div className="sticky-cta"><div className="row g12 wrapf">
        <button className="btn btn-p" onClick={() => go('learn')} disabled={!allRead}>{t('Practise the situations', 'स्थितियों का अभ्यास करें', 'परिस्थितींचा सराव करा')} {Icon.right()}</button>
        <button className="btn btn-s" onClick={() => go('test')} disabled={!allRead}>{t('Go straight to the test', 'सीधे टेस्ट पर जाएं', 'सरळ टेस्टकडे जा')}</button>
      </div></div>
    </div>
  );
}
