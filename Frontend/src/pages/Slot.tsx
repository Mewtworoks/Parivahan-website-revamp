import { useEffect, useState } from 'react';
import * as api from '../api';
import { useT } from '../lib/language';
import { useApi, useAction } from '../lib/useApi';
import { useOffices } from '../lib/useOffices';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill, Tile } from '../ui/SharedUI';

/**
 * Book the RTO test slot — pick an office, a date, then a time. Exempt
 * entirely for Aadhaar applicants.
 *
 * The dates, times and remaining counts are the office's real availability,
 * and confirming holds the slot on the server. If two people confirm the same
 * time, exactly one gets it and the other is told immediately, here, rather
 * than both being sent to the same counter.
 */
export function Slot({ go, state, update }: PageProps) {
  const t = useT();
  const form = state.form || {};
  const { offices, live } = useOffices(form.state);
  const [officeId, setOfficeId] = useState(form.rto || '');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<api.SlotTime | null>(null);
  const [taken, setTaken] = useState(false);
  const { pending, error, run } = useAction();

  // Keep the selection valid when the office list arrives or the state changes.
  useEffect(() => {
    if (offices.length && !offices.some(o => o.id === officeId)) {
      setOfficeId(offices[0].id);
      setDay(null);
      setTime(null);
    }
  }, [offices, officeId]);

  const office = offices.find(o => o.id === officeId) || offices[0];

  const { data: dayData } = useApi(
    signal => api.slotDays(officeId, signal),
    [officeId],
    Boolean(officeId),
  );
  const { data: timeData, reload: reloadTimes } = useApi(
    signal => api.slotTimes(officeId, day!, signal),
    [officeId, day],
    Boolean(officeId && day),
  );

  const days = dayData?.days ?? [];
  const times = timeData?.times ?? [];
  const chosenDay = days.find(d => d.date === day);

  const confirm = async (then: 'tutorial' | 'status') => {
    if (!time?.slot_id || !state.applicationId) return;
    setTaken(false);
    const booked = await run('book', () => api.bookSlot(state.applicationId!, time.slot_id!));
    if (!booked) {
      // 409 means someone else confirmed this exact slot first. Show what is
      // left now instead of sending the applicant to a slot they do not hold.
      setTaken(true);
      setTime(null);
      reloadTimes();
      return;
    }
    update({
      slot: {
        day: booked.label, time: booked.time, rto: office.name,
        bookingId: booked.booking_id, tester: booked.tester || undefined,
      },
      stage: 'booked',
    });
    go(then);
  };

  if (!office) {
    return <div className="narrow fade" style={{ padding: '40px 24px 0' }}><Note>{t('Loading offices…', 'कार्यालय लोड हो रहे हैं…')}</Note></div>;
  }

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g10" style={{ marginBottom: 26 }}><span className="eyebrow">{t('Application', 'आवेदन', 'अर्ज')} {state.app?.no || '—'} · {t('stage 7', 'चरण 7', 'टप्पा 7')}</span><h1>{t('Book your test slot', 'अपना टेस्ट स्लॉट बुक करें', 'तुमचा टेस्ट स्लॉट बुक करा')}</h1>
        <p className="lede">{t('You are shown the offices that can take your test, how far they are, and what is actually left. A booking here is an appointment, not a queue token.', 'आपको वे कार्यालय दिखाए जाते हैं जो आपका टेस्ट ले सकते हैं, वे कितनी दूर हैं, और वास्तव में क्या बचा है। यहां बुकिंग एक अपॉइंटमेंट है, कतार टोकन नहीं।', 'तुम्हाला ती कार्यालये दाखवली जातात जी तुमची टेस्ट घेऊ शकतात, ती किती दूर आहेत, आणि प्रत्यक्षात काय शिल्लक आहे. इथे बुकिंग म्हणजे एक भेटीची वेळ आहे, रांगेचे टोकन नाही.')}</p></div>

      {!state.applicationId && (
        <div style={{ marginBottom: 16 }}><Note tone="warn">{t('There is no submitted application to book against yet. Complete the application first and this page will hold a real appointment for it.', 'बुक करने के लिए अभी कोई जमा किया गया आवेदन नहीं है। पहले आवेदन पूरा करें, फिर यह पेज उसके लिए असली अपॉइंटमेंट रखेगा।')}</Note></div>
      )}
      {form.route === 'aadhaar' && <div style={{ marginBottom: 16 }}><Note tone="brand">{t('This stage is exempt for you — an Aadhaar-authenticated application takes the test from home. You are only here because you chose to look.', 'यह चरण आपके लिए छूट में है — आधार-प्रमाणित आवेदन घर से टेस्ट देता है। आप यहां केवल इसलिए हैं क्योंकि आपने देखना चुना।', 'हा टप्पा तुमच्यासाठी सूट आहे — आधार-प्रमाणित अर्ज घरून टेस्ट देतो. तुम्ही इथे फक्त पाहण्याचे निवडले म्हणून आहात.')}</Note></div>}
      {taken && <div style={{ marginBottom: 16 }}><Note tone="warn"><b>{t('That time went to someone else.', 'वह समय किसी और को मिल गया।')}</b> {t('It was taken while you were deciding. The times below are what is free right now — nobody is double-booked, and you have not lost your place in the application.', 'आप तय कर रहे थे तभी वह ले लिया गया। नीचे दिए समय अभी खाली हैं — किसी की दोहरी बुकिंग नहीं हुई, और आपका आवेदन जहां था वहीं है।')}</Note></div>}
      {error && !taken && <div style={{ marginBottom: 16 }}><Note tone="warn">{api.isOffline(error) ? t('The licence service is not responding, so no appointment can be held right now.', 'लाइसेंस सेवा जवाब नहीं दे रही, इसलिए अभी कोई अपॉइंटमेंट नहीं रखा जा सकता।') : error.message}</Note></div>}

      <div className="col g20">
        <div className="col g12"><span className="label">{t('Choose an office', 'एक कार्यालय चुनें', 'एक कार्यालय निवडा')}</span>
          {offices.map(o => (
            <Tile key={o.id} checked={officeId === o.id} onClick={() => { setOfficeId(o.id); setDay(null); setTime(null); setTaken(false); }} title={o.name}
              desc={`${o.area} · ${o.km} km away`}
              right={<span className="col g6" style={{ alignItems: 'flex-end', flex: 'none' }}><Pill tone={o.load === 'light' ? 'ok' : 'warn'}>{o.load === 'light' ? t('Light day', 'हल्का दिन', 'कमी दिवस') : t('Busy', 'व्यस्त', 'व्यग्र')}</Pill><span className="tiny">{o.wait}</span></span>} />
          ))}
          {live && <span className="tiny">{t('Waiting times are read from each office as it stands now.', 'प्रतीक्षा समय हर कार्यालय से इस समय की स्थिति के अनुसार पढ़ा गया है।')}</span>}
        </div>

        <div className="card card-p col g16">
          <div className="row between g12 wrapf"><h3>{t('Pick a date', 'एक तारीख चुनें', 'एक तारीख निवडा')}</h3><span className="tiny row g6">{Icon.pin()} {office.name}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
            {days.map(d => (
              <button key={d.date} className="slot" aria-pressed={day === d.date} disabled={!d.left} onClick={() => { setDay(d.date); setTime(null); setTaken(false); }}>
                <span className="col g4"><b style={{ fontWeight: 600, fontSize: '.92rem' }}>{d.label}</b><span className="tiny" style={{ color: day === d.date ? 'oklch(0.92 0.03 262)' : undefined }}>{d.left ? t(`${d.left} left`, `${d.left} बचे`, `${d.left} शिल्लक`) : t('Full', 'भरा हुआ', 'भरलेले')}</span></span>
              </button>
            ))}
            {days.length === 0 && <span className="tiny">{t('No dates available from the service.', 'सेवा से कोई तारीख उपलब्ध नहीं।')}</span>}
          </div>
          {day && (
            <div className="col g12 fade"><hr className="hr" /><h3>{t('Pick a time', 'एक समय चुनें', 'एक वेळ निवडा')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
                {times.map(x => (
                  <button key={x.start} className="slot" aria-pressed={time?.start === x.start} disabled={!x.left} onClick={() => { setTime(x); setTaken(false); }}>
                    <span className="col g4"><b style={{ fontWeight: 600, fontSize: '.92rem' }}>{x.time}</b><span className="tiny" style={{ color: time?.start === x.start ? 'oklch(0.92 0.03 262)' : undefined }}>{x.left ? t(`${x.left} left`, `${x.left} बचे`, `${x.left} शिल्लक`) : t('Full', 'भरा हुआ', 'भरलेले')}</span></span>
                  </button>
                ))}
              </div>
              <span className="tiny">{t('Counts are the office\'s actual remaining capacity for that time, across its inspectors.', 'गिनती उस समय के लिए कार्यालय की असली बची क्षमता है, उसके सभी निरीक्षकों को मिलाकर।')}</span>
            </div>
          )}
        </div>

        {time && chosenDay && (
          <div className="card card-p col g14 fade">
            <Pill tone="brand">{t('Ready to confirm', 'पुष्टि के लिए तैयार', 'पुष्टीसाठी तयार')}</Pill>
            <h2>{chosenDay.label}, {time.time} · {office.name}</h2>
            <p className="sub">{t(`Bring the originals of your age and address proof, a print of the e-receipt and this appointment letter. Reach ten minutes early. ${office.wait.toLowerCase()}.`, `अपने आयु और पता प्रमाण की मूल प्रति, ई-रसीद का प्रिंट और यह अपॉइंटमेंट लेटर लाएं। दस मिनट पहले पहुंचें। ${office.wait.toLowerCase()}।`, `तुमच्या वय आणि पत्ता पुराव्याची मूळ प्रत, ई-पावतीची प्रिंट आणि हे अपॉइंटमेंट लेटर आणा. दहा मिनिटे आधी पोहोचा. ${office.wait.toLowerCase()}.`)}</p>
            <div className="row g12 wrapf">
              <button className="btn btn-p" disabled={!state.applicationId || pending === 'book'} onClick={() => void confirm('tutorial')}>{pending === 'book' ? t('Holding the slot…', 'स्लॉट रखा जा रहा है…') : t('Confirm and prepare for the test', 'पुष्टि करें और टेस्ट की तैयारी करें', 'पुष्टी करा आणि टेस्टची तयारी करा')} {Icon.right()}</button>
              <button className="btn btn-s" disabled={!state.applicationId || pending === 'book'} onClick={() => void confirm('status')}>{t('Confirm only', 'केवल पुष्टि करें', 'फक्त पुष्टी करा')}</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
