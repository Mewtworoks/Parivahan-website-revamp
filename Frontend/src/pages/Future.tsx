import { useT } from '../lib/language';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';

/**
 * The idea, told in as few words as it takes.
 *
 * This page was twice this length and read like a design document: four cards,
 * two tables and six hundred words to say one thing. It is meant to be pointed
 * at during a three-minute demo by somebody talking over it, so the rule here
 * is that every block has to survive being read aloud in one breath.
 *
 * The honesty machinery stays, because the risk has not changed: a page showing
 * what a service *would* know, drawn in the same visual language as the pages
 * showing what it *does* know, is the exact dishonesty the rest of this build
 * avoids. Hence the concept pill, the standing banner, the dashed borders and
 * the per-card label — four layers, because somebody will screenshot one card
 * without the banner.
 */

/** A card whose contents are invented, and says so on itself. */
function Concept({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="card card-p col g14" style={{ borderStyle: 'dashed' }}>
      <div className="row between g10 wrapf" style={{ alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <Pill>{Icon.bang()} <span className="tiny">{t('Made up', 'गढ़ा हुआ')}</span></Pill>
      </div>
      {children}
    </div>
  );
}

export function Future({ go }: PageProps) {
  const t = useT();

  return (
    <div className="narrow fade" style={{ padding: '48px 24px 64px' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }}
        onClick={() => go('home')}>{Icon.left()} {t('Home', 'होम', 'होम')}</button>

      <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 24 }}>
        {/* Carries the footer's own words, so the link and the page it lands on
            are recognisably the same thing. */}
        <Pill tone="warn">{Icon.bang()} {t('Government brain · an idea, nothing measured', 'सरकारी दिमाग · एक विचार, कुछ भी मापा नहीं गया')}</Pill>
        <h1>{t('Notice before anyone complains', 'शिकायत आने से पहले पता चल जाए')}</h1>
        {/* The whole thing, in one sentence, at a size somebody can read off a
            screen while being talked over. */}
        <p style={{ fontSize: '1.22rem', lineHeight: 1.55, fontFamily: 'var(--disp)', maxWidth: '38ch' }}>
          {t('Government services find out something is broken when enough people complain. This one would notice when they go quiet.',
            'सरकारी सेवाओं को तब पता चलता है कि कुछ टूटा है, जब पर्याप्त लोग शिकायत करते हैं। यह सेवा तब पता लगा लेती जब लोग चुप हो जाते हैं।')}
        </p>
      </div>

      <div className="col g20">

        {/* Two triggers, side by side, because the second is the one people
            miss and it needs equal weight rather than a subordinate clause. */}
        <div className="grid2" style={{ gap: 16 }}>
          <div className="card card-p col g8">
            <Pill tone="warn">{t('It broke', 'कुछ टूटा')}</Pill>
            <p className="sub" style={{ lineHeight: 1.6 }}>
              {t('A field would not take their answer. A slot vanished as they pressed confirm. Something failed, and the service knows it failed.',
                'किसी फ़ील्ड ने उनका जवाब नहीं लिया। पुष्टि दबाते ही स्लॉट चला गया। कुछ विफल हुआ, और सेवा को पता है कि विफल हुआ।')}
            </p>
          </div>
          <div className="card card-p col g8">
            <Pill tone="brand">{t('They did not understand', 'वे समझ नहीं पाए')}</Pill>
            <p className="sub" style={{ lineHeight: 1.6 }}>
              {t('Nothing failed at all. The form worked perfectly. They just did not know what it wanted, so they went back — or closed the tab. Nobody finds out.',
                'कुछ भी विफल नहीं हुआ। फ़ॉर्म ठीक चला। बस उन्हें समझ नहीं आया कि क्या माँगा जा रहा है, तो वे पीछे चले गए — या टैब बंद कर दिया। किसी को पता नहीं चलता।')}
            </p>
          </div>
        </div>

        <Note tone="warn">
          {t('Everything below is invented.', 'नीचे सब कुछ गढ़ा हुआ है।')}{' '}
          {t('It is an example of what this would say, not something it has said. The real counts are on the next page.',
            'यह उदाहरण है कि यह क्या कहती, न कि उसने कुछ कहा है। असली गिनती अगले पन्ने पर है।')}
        </Note>

        <Concept title={t('The same afternoon, two ways', 'वही दोपहर, दो तरह से')}>
          <div className="col g14">
            <div className="flat col g6" style={{ padding: 16 }}>
              <span className="label">{t('How it goes today', 'आज कैसे होता है')}</span>
              <p className="sub" style={{ lineHeight: 1.6, margin: 0 }}>
                {t('Forty-seven people reach stage 4, do not understand it, and leave. None of them complains. Nobody at the department ever learns it happened.',
                  'सैंतालीस लोग चरण 4 तक पहुँचते हैं, समझ नहीं पाते, और चले जाते हैं। कोई शिकायत नहीं करता। विभाग में किसी को कभी पता नहीं चलता कि ऐसा हुआ।')}
              </p>
            </div>
            <div className="flat col g6" style={{ padding: 16, borderColor: 'var(--brand-line)' }}>
              <span className="label">{t('How it would go', 'ऐसे होता')}</span>
              <p className="sub" style={{ lineHeight: 1.6, margin: 0, color: 'var(--ink)' }}>
                <b>{t('“Stage 4 lost 47 people this afternoon. It normally loses 6.”',
                  '“चरण 4 ने आज दोपहर 47 लोग खोए। आम तौर पर 6 खोता है।”')}</b>
              </p>
              <span className="tiny">
                {t('Read at 4pm, not next quarter. By somebody who can rewrite stage 4.',
                  'शाम 4 बजे पढ़ा गया, अगली तिमाही में नहीं। उस व्यक्ति ने, जो चरण 4 दोबारा लिख सकता है।')}
              </span>
            </div>
          </div>
        </Concept>

        <Concept title={t('What it would watch', 'यह क्या देखती')}>
          <div className="col g10">
            {([
              [t('Pressed Back', 'पीछे दबाया'), t('This step asked something they were not ready for', 'यह चरण कुछ ऐसा माँग रहा था जिसके लिए वे तैयार नहीं थे')],
              [t('Filled it in, then changed it', 'भरा, फिर बदला'), t('The question was ambiguous', 'सवाल दुविधा भरा था')],
              [t('Sat on one step a long time', 'एक ही चरण पर बहुत देर रुके'), t('They were stuck, and did not say so', 'वे अटके थे, और बोले नहीं')],
              [t('Left and never came back', 'छोड़कर लौटे ही नहीं'), t('This is where the journey dies', 'यहीं यात्रा खत्म हो जाती है')],
            ] as [string, string][]).map(([what, means]) => (
              <div key={what} className="row between g16 wrapf" style={{ alignItems: 'baseline' }}>
                <b style={{ flex: '0 0 auto' }}>{what}</b>
                <span className="sub" style={{ flex: '1 1 220px', textAlign: 'right' }}>{means}</span>
              </div>
            ))}
          </div>
        </Concept>

        {/* The trust point, and the one card that is not dashed, because every
            word of it is true today. */}
        <div className="card card-p col g14">
          <h3>{t('What it would never record', 'यह कभी दर्ज नहीं करती')}</h3>
          <div className="grid2" style={{ gap: 16 }}>
            <div className="col g8">
              <Pill tone="ok">{Icon.check()} {t('Kept', 'रखा जाता है')}</Pill>
              <span className="sub">{t('Which step. Which field. How long. Nothing else.',
                'कौन-सा चरण। कौन-सी फ़ील्ड। कितनी देर। और कुछ नहीं।')}</span>
            </div>
            <div className="col g8">
              <Pill tone="warn">{Icon.bang()} {t('Never kept', 'कभी नहीं रखा जाता')}</Pill>
              <span className="sub">{t('Names, dates of birth, Aadhaar, addresses, phone numbers — or anything they typed.',
                'नाम, जन्म तिथि, आधार, पता, फ़ोन नंबर — या उन्होंने जो कुछ लिखा।')}</span>
            </div>
          </div>
          {/* Said plainly because it is the question a judge asks second, right
              after "isn't this just analytics?". */}
          <span className="tiny">
            {t('Session-replay tools record the screen, which on a licence form means recording somebody’s Aadhaar number. This records that step 4 lost somebody, and nothing about who.',
              'सेशन-रिप्ले उपकरण स्क्रीन रिकॉर्ड करते हैं, जिसका लाइसेंस फ़ॉर्म पर मतलब है किसी का आधार नंबर रिकॉर्ड करना। यह सिर्फ़ इतना दर्ज करती है कि चरण 4 ने किसी को खोया, यह नहीं कि कौन था।')}
          </span>
        </div>

        <div className="card card-p col g14">
          <h3>{t('What already works', 'अभी क्या चल रहा है')}</h3>
          <p className="sub" style={{ lineHeight: 1.6 }}>
            {t('The recording half is built and running on this site — eight kinds of trouble, stored with no way back to who hit them. What is missing is memory: it can say what is happening, but not that it changed. That is the whole gap between this page and the next one.',
              'रिकॉर्ड करने वाला हिस्सा इसी साइट पर बना और चालू है — आठ तरह की दिक्कतें, ऐसे संग्रहीत कि किसे हुईं यह पता न चले। कमी है याददाश्त की: यह बता सकती है कि क्या हो रहा है, यह नहीं कि क्या बदला। इस पन्ने और अगले पन्ने के बीच बस यही फ़र्क है।')}
          </p>
          <div className="row g10 wrapf">
            <button className="btn btn-p" onClick={() => go('learning')}>
              {t('See the real counts', 'असली गिनती देखें')} {Icon.right()}
            </button>
            <button className="btn btn-s" onClick={() => go('proof')}>
              {t('See the guarantees run', 'गारंटी चलती देखें')}
            </button>
          </div>
        </div>
      </div>
      <div style={{ height: 40 }} />
    </div>
  );
}
