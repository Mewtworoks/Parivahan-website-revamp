import { useState } from 'react';
import { DAYS, rtosFor, TIMES } from '../data/rtoOffices';
import { useT } from '../lib/language';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill, Tile } from '../ui/SharedUI';

/** Book the RTO test slot — pick an office, a date, then a time. Exempt entirely for Aadhaar applicants. */
export function Slot({ go, state, update }: PageProps) {
  const t = useT();
  const form = state.form || {};
  const offices = rtosFor(form.state || 'Maharashtra');
  const [officeId, setOfficeId] = useState(offices.find(o => o.id === form.rto) ? form.rto! : offices[0].id);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const office = offices.find(o => o.id === officeId) || offices[0];

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g10" style={{ marginBottom: 26 }}><span className="eyebrow">Application SS-2026-004182 · stage 7</span><h1>{t('Book your test slot', 'अपना टेस्ट स्लॉट बुक करें', 'तुमचा टेस्ट स्लॉट बुक करा')}</h1>
        <p className="lede">{t('You are shown the offices that can take your test, how far they are, and what is actually left. A booking here is an appointment, not a queue token.', 'आपको वे कार्यालय दिखाए जाते हैं जो आपका टेस्ट ले सकते हैं, वे कितनी दूर हैं, और वास्तव में क्या बचा है। यहां बुकिंग एक अपॉइंटमेंट है, कतार टोकन नहीं।', 'तुम्हाला ती कार्यालये दाखवली जातात जी तुमची टेस्ट घेऊ शकतात, ती किती दूर आहेत, आणि प्रत्यक्षात काय शिल्लक आहे. इथे बुकिंग म्हणजे एक भेटीची वेळ आहे, रांगेचे टोकन नाही.')}</p></div>
      {form.route === 'aadhaar' && <div style={{ marginBottom: 16 }}><Note tone="brand">{t('This stage is exempt for you — an Aadhaar-authenticated application takes the test from home. You are only here because you chose to look.', 'यह चरण आपके लिए छूट में है — आधार-प्रमाणित आवेदन घर से टेस्ट देता है। आप यहां केवल इसलिए हैं क्योंकि आपने देखना चुना।', 'हा टप्पा तुमच्यासाठी सूट आहे — आधार-प्रमाणित अर्ज घरून टेस्ट देतो. तुम्ही इथे फक्त पाहण्याचे निवडले म्हणून आहात.')}</Note></div>}
      <div className="col g20">
        <div className="col g12"><span className="label">{t('Choose an office', 'एक कार्यालय चुनें', 'एक कार्यालय निवडा')}</span>
          {offices.map(o => (
            <Tile key={o.id} checked={officeId === o.id} onClick={() => { setOfficeId(o.id); setDay(null); setTime(null); }} title={o.name}
              desc={`${o.area} · ${o.km} km away`}
              right={<span className="col g6" style={{ alignItems: 'flex-end', flex: 'none' }}><Pill tone={o.load === 'light' ? 'ok' : 'warn'}>{o.load === 'light' ? t('Light day', 'हल्का दिन', 'कमी दिवस') : t('Busy', 'व्यस्त', 'व्यग्र')}</Pill><span className="tiny">{o.wait}</span></span>} />
          ))}
        </div>
        <div className="card card-p col g16">
          <div className="row between g12 wrapf"><h3>{t('Pick a date', 'एक तारीख चुनें', 'एक तारीख निवडा')}</h3><span className="tiny row g6">{Icon.pin()} {office.name}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
            {DAYS.map(d => (
              <button key={d.d} className="slot" aria-pressed={day === d.d} disabled={!d.left} onClick={() => { setDay(d.d); setTime(null); }}>
                <span className="col g4"><b style={{ fontWeight: 600, fontSize: '.92rem' }}>{d.d}</b><span className="tiny" style={{ color: day === d.d ? 'oklch(0.92 0.03 262)' : undefined }}>{d.left ? t(`${d.left} left`, `${d.left} बचे`, `${d.left} शिल्लक`) : t('Full', 'भरा हुआ', 'भरलेले')}</span></span>
              </button>
            ))}
          </div>
          {day && (
            <div className="col g12 fade"><hr className="hr" /><h3>{t('Pick a time', 'एक समय चुनें', 'एक वेळ निवडा')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
                {TIMES.map(x => (
                  <button key={x.t} className="slot" aria-pressed={time === x.t} disabled={!x.left} onClick={() => setTime(x.t)}>
                    <span className="col g4"><b style={{ fontWeight: 600, fontSize: '.92rem' }}>{x.t}</b><span className="tiny" style={{ color: time === x.t ? 'oklch(0.92 0.03 262)' : undefined }}>{x.left ? t(`${x.left} left`, `${x.left} बचे`, `${x.left} शिल्लक`) : t('Full', 'भरा हुआ', 'भरलेले')}</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {time && day && (
          <div className="card card-p col g14 fade">
            <Pill tone="brand">{t('Ready to confirm', 'पुष्टि के लिए तैयार', 'पुष्टीसाठी तयार')}</Pill>
            <h2>{day}, {time} · {office.name}</h2>
            <p className="sub">{t(`Bring the originals of your age and address proof, a print of the e-receipt and this appointment letter. Reach ten minutes early. ${office.wait.toLowerCase()}.`, `अपने आयु और पता प्रमाण की मूल प्रति, ई-रसीद का प्रिंट और यह अपॉइंटमेंट लेटर लाएं। दस मिनट पहले पहुंचें। ${office.wait.toLowerCase()}।`, `तुमच्या वय आणि पत्ता पुराव्याची मूळ प्रत, ई-पावतीची प्रिंट आणि हे अपॉइंटमेंट लेटर आणा. दहा मिनिटे आधी पोहोचा. ${office.wait.toLowerCase()}.`)}</p>
            <div className="row g12 wrapf">
              <button className="btn btn-p" onClick={() => { update({ slot: { day, time, rto: office.name }, stage: 'booked' }); go('tutorial'); }}>{t('Confirm and prepare for the test', 'पुष्टि करें और टेस्ट की तैयारी करें', 'पुष्टी करा आणि टेस्टची तयारी करा')} {Icon.right()}</button>
              <button className="btn btn-s" onClick={() => { update({ slot: { day, time, rto: office.name }, stage: 'booked' }); go('status'); }}>{t('Confirm only', 'केवल पुष्टि करें', 'फक्त पुष्टी करा')}</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
