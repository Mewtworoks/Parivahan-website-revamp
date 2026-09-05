import { useState } from 'react';
import { CAPTCHA_QUESTIONS } from '../../data/theoryTest';
import { useLanguage, useT } from '../../lib/language';
import { Icon } from '../../ui/Icon';
import { Input, Note, Pill } from '../../ui/SharedUI';

/**
 * Read the question in the language it is being shown in.
 *
 * The whole argument for keeping this check is that a screen reader can say it
 * out loud, and a Hindi question spoken with an English voice is not that —
 * "एक मोटरसाइकिल में कितने पहिये होते हैं?" read as English is noise.
 */
function speakQuestion(text: string, locale: string) {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis isn't available in every browser.
  }
}

/** A plain-language abuse-check to replace the official form's distorted-text captcha. */
export function Captcha({ ok, onOk }: { ok: boolean; onOk: (v: boolean) => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * CAPTCHA_QUESTIONS.length));
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const question = CAPTCHA_QUESTIONS[index];
  const asked = t(question.q, question.qHi, question.qMr);

  const askDifferent = () => { setIndex((index + 1) % CAPTCHA_QUESTIONS.length); setAnswer(''); setWrong(false); onOk(false); };
  const check = () => {
    const correct = question.a.includes(answer.trim().toLowerCase());
    onOk(correct);
    setWrong(!correct);
  };

  return (
    <div className="card card-p col g14">
      <div className="row between g12 wrapf">
        <h3>{t('One check that you are a person', 'एक जांच कि आप एक व्यक्ति हैं', 'एक तपासणी की तुम्ही एक व्यक्ती आहात')}</h3>
        <Pill>{t('Required', 'आवश्यक', 'आवश्यक')}</Pill>
      </div>
      <p className="sub">{t(
        'The official form ends on a distorted-text captcha. A public form does need some abuse protection, so this stays — but as a question anyone can answer, that a screen reader can read out, and that you can swap for another. Warped letters exclude people with low vision and stop no real attacker.',
        'आधिकारिक फॉर्म एक टेढ़े-मेढ़े अक्षरों वाले कैप्चा पर खत्म होता है। एक सार्वजनिक फॉर्म को दुरुपयोग से कुछ सुरक्षा चाहिए, इसलिए यह रहेगा — पर एक ऐसे सवाल के रूप में जिसका जवाब कोई भी दे सके, जिसे स्क्रीन रीडर पढ़कर सुना सके, और जिसे आप बदल सकें। टेढ़े अक्षर कम दृष्टि वाले लोगों को बाहर कर देते हैं और किसी असली हमलावर को नहीं रोकते।',
        'अधिकृत फॉर्म वाकड्या-तिकड्या अक्षरांच्या कॅप्चावर संपतो. सार्वजनिक फॉर्मला गैरवापरापासून काही संरक्षण हवे, म्हणून हे राहील — पण अशा प्रश्नाच्या रूपात ज्याचे उत्तर कोणीही देऊ शकेल, जो स्क्रीन रीडर वाचून दाखवू शकेल, आणि जो तुम्ही बदलू शकाल. वाकडी अक्षरे कमी दृष्टी असलेल्यांना बाहेर ठेवतात आणि खऱ्या हल्लेखोराला थांबवत नाहीत.')}</p>
      <div className="flat col g12" style={{ padding: '16px 18px' }}>
        <div className="row between g12 wrapf">
          <b style={{ fontWeight: 600, fontSize: '1.02rem' }}>{asked}</b>
          <div className="row g8">
            <button className="btn btn-s btn-sm" onClick={() => speakQuestion(asked, lang === 'en' ? 'en-IN' : 'hi-IN')}
              aria-label={t('Read the question aloud', 'सवाल को पढ़कर सुनाएं', 'प्रश्न वाचून दाखवा')}>{Icon.speaker()}</button>
            <button className="btn btn-s btn-sm" onClick={askDifferent}>{t('Different question', 'दूसरा सवाल', 'दुसरा प्रश्न')}</button>
          </div>
        </div>
        <div className="row g10 wrapf">
          <Input style={{ maxWidth: 200 }} placeholder={t('Your answer', 'आपका जवाब', 'तुमचे उत्तर')} value={answer} disabled={ok}
            onChange={e => { setAnswer(e.target.value); setWrong(false); if (ok) onOk(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); check(); } }} />
          {ok ? <Pill tone="ok">{Icon.check()} {t('Verified', 'सत्यापित', 'सत्यापित')}</Pill>
            : <button className="btn btn-s" disabled={!answer.trim()} onClick={check}>{t('Check', 'जांचें', 'तपासा')}</button>}
        </div>
        {wrong && <span className="err" role="alert">{t(
          'That is not right. Try again, or swap it for a different question — no penalty either way.',
          'यह सही नहीं है। फिर कोशिश करें, या दूसरा सवाल ले लें — दोनों में कोई नुकसान नहीं।',
          'हे बरोबर नाही. पुन्हा प्रयत्न करा, किंवा दुसरा प्रश्न घ्या — दोन्हीत काहीही नुकसान नाही.')}</span>}
      </div>
      <Note>{t(
        'No attempt limit and no lockout. Getting this wrong is never a reason to lose a completed application.',
        'कोशिशों की कोई सीमा नहीं और कोई लॉकआउट नहीं। यह गलत होना कभी भी एक पूरे भरे आवेदन को खोने की वजह नहीं है।',
        'प्रयत्नांची मर्यादा नाही आणि लॉकआउट नाही. हे चुकणे हे पूर्ण भरलेला अर्ज गमावण्याचे कारण कधीच नाही.')}</Note>
    </div>
  );
}
