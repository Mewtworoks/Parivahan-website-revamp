import { useEffect, useState } from 'react';
import * as api from '../api';
import { formatDayLabel, formatOfficeWait } from '../lib/format';
import { useLanguage, useT } from '../lib/language';
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
  const { lang } = useLanguage();
  const form = state.form || {};
  const { offices, live } = useOffices(form.state);
  const [officeId, setOfficeId] = useState(form.rto || '');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<api.SlotTime | null>(null);
  const [taken, setTaken] = useState(false);
  /** The held appointment, shown back before moving on. Null until Confirm succeeds. */
  const [done, setDone] = useState<{ booked: api.BookResult; then: 'tutorial' | 'status' } | null>(null);
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
    // Losing the race is the guarantee working, so it gets its own message and
    // a fresh list. Every other failure is a different sentence, and this used
    // to report all four the same way: a cold backend, an appointment already
    // held, and a time that had passed all read as "someone else took it".
    // The first of those is the likely one — the service sleeps after fifteen
    // minutes idle — and it sent people hunting for another slot that would not
    // book either. Only the slot-taken 409 is caught here; everything else is
    // rethrown so it reaches `error` and the Note at the top of the page.
    let lost = false;
    const booked = await run('book', async () => {
      try {
        return await api.bookSlot(state.applicationId!, time.slot_id!);
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 409 && /just taken/i.test(err.detail)) {
          lost = true;
          return null;
        }
        throw err;
      }
    });
    if (!booked) {
      if (lost) {
        setTaken(true);
        setTime(null);
        reloadTimes();
      }
      return;
    }
    update({
      slot: {
        day: booked.label, time: booked.time, rto: office.name,
        bookingId: booked.booking_id, tester: booked.tester || undefined,
      },
      stage: 'booked',
    });
    // Stop here rather than routing straight on. The page told the citizen to
    // bring "this appointment letter" and then never showed them one — the
    // booking reference was stored and rendered nowhere on the site. This is
    // also the screen that proves the appointment is real, which is the thing
    // somebody is looking for after pressing Confirm.
    setDone({ booked, then });
  };

  if (!office) {
    return <div className="narrow fade" style={{ padding: '40px 24px 0' }}><Note>{t('Loading offices…', 'कार्यालय लोड हो रहे हैं…')}</Note></div>;
  }

  if (done) {
    const { booked } = done;
    return (
      <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
        <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 26 }}>
          <Pill tone="ok">{Icon.check()} {t('Appointment held', 'अपॉइंटमेंट सुरक्षित', 'भेटीची वेळ राखीव')}</Pill>
          <h1>{formatDayLabel(booked.date, booked.label, lang)}, {booked.time}</h1>
          <p className="lede">{t('This slot is now yours and nobody else can be given it. Everything below is what the service recorded, not what this page remembers.', 'यह स्लॉट अब आपका है और किसी और को नहीं दिया जा सकता। नीचे सब कुछ वही है जो सेवा ने दर्ज किया, न कि जो यह पेज याद रखता है।')}</p>
        </div>
        <div className="card card-p col g14">
          <dl className="kv">
            <dt>{t('Booking reference', 'बुकिंग संदर्भ', 'बुकिंग संदर्भ')}</dt><dd className="mono">{booked.booking_id}</dd>
            <dt>{t('Office', 'कार्यालय', 'कार्यालय')}</dt><dd>{office.name}</dd>
            {booked.tester && <><dt>{t('Inspector', 'निरीक्षक', 'निरीक्षक')}</dt><dd>{booked.tester}</dd></>}
            <dt>{t('Application', 'आवेदन', 'अर्ज')}</dt><dd className="mono">{state.app?.no || '—'}</dd>
          </dl>
          <hr className="hr" />
          <p className="sub">{t('Bring the originals of your age and address proof, a print of the e-receipt, and this reference. Arrive ten minutes early and say you have arrived on the tracker — that puts you in the live queue.', 'अपने आयु और पता प्रमाण की मूल प्रति, ई-रसीद का प्रिंट, और यह संदर्भ लाएं। दस मिनट पहले पहुंचें और ट्रैकर पर बताएं कि आप पहुंच गए हैं — इससे आप लाइव कतार में आ जाते हैं।')}</p>
        </div>
        <div className="sticky-cta">
          <div className="row g12 wrapf">
            <button className="btn btn-p" onClick={() => go(done.then)}>
              {done.then === 'tutorial'
                ? t('Prepare for the test', 'टेस्ट की तैयारी करें', 'टेस्टची तयारी करा')
                : t('Go to my application', 'मेरे आवेदन पर जाएं', 'माझ्या अर्जाकडे जा')} {Icon.right()}
            </button>
            <button className="btn btn-s" onClick={() => go('status')}>{t('Track it', 'ट्रैक करें', 'ट्रॅक करा')}</button>
          </div>
        </div>
        <div style={{ height: 56 }} />
      </div>
    );
  }

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g10" style={{ marginBottom: 26 }}><span className="eyebrow">{t('Application', 'आवेदन', 'अर्ज')} {state.app?.no || '—'} · {t('stage 7', 'चरण 7', 'टप्पा 7')}</span><h1>{t("Book your learner's test slot", 'अपना लर्नर टेस्ट स्लॉट बुक करें', 'तुमचा लर्नर टेस्ट स्लॉट बुक करा')}</h1>
        <p className="lede">{t('You are shown the offices that can take your test, how far they are, and what is actually left. A booking here is an appointment, not a queue token.', 'आपको वे कार्यालय दिखाए जाते हैं जो आपका टेस्ट ले सकते हैं, वे कितनी दूर हैं, और वास्तव में क्या बचा है। यहां बुकिंग एक अपॉइंटमेंट है, कतार टोकन नहीं।', 'तुम्हाला ती कार्यालये दाखवली जातात जी तुमची टेस्ट घेऊ शकतात, ती किती दूर आहेत, आणि प्रत्यक्षात काय शिल्लक आहे. इथे बुकिंग म्हणजे एक भेटीची वेळ आहे, रांगेचे टोकन नाही.')}</p></div>

      {!state.applicationId && (
        <div style={{ marginBottom: 16 }}><Note tone="warn">{t('There is no submitted application to book against yet. Complete the application first and this page will hold a real appointment for it.', 'बुक करने के लिए अभी कोई जमा किया गया आवेदन नहीं है। पहले आवेदन पूरा करें, फिर यह पेज उसके लिए असली अपॉइंटमेंट रखेगा।')}</Note></div>
      )}
      {form.route === 'aadhaar' && <div style={{ marginBottom: 16 }}><Note tone="brand">{t('This stage is exempt for you — an Aadhaar-authenticated application takes the test from home. You are only here because you chose to look.', 'यह चरण आपके लिए छूट में है — आधार-प्रमाणित आवेदन घर से टेस्ट देता है। आप यहां केवल इसलिए हैं क्योंकि आपने देखना चुना।', 'हा टप्पा तुमच्यासाठी सूट आहे — आधार-प्रमाणित अर्ज घरून टेस्ट देतो. तुम्ही इथे फक्त पाहण्याचे निवडले म्हणून आहात.')}</Note></div>}
      {/* Said out loud rather than left for someone to notice. On the live
          service the learner's test is taken online, so an in-person slot for
          it is the exception and not the rule — the Aadhaar note directly above
          is the real journey. The booking engine is shown here because it is
          the part of this build worth showing, and because the appointment it
          holds is the same one the driving test needs a month later. */}
      <div style={{ marginBottom: 16 }}><Note>{t("Where this differs from the real service. The learner's test is taken online now, so this booking screen stands in for the one that matters: the driving test, booked thirty days after the learner's licence is issued. The allocation underneath is real either way — one slot, one applicant, proved on the Proof page.", 'यह असली सेवा से कहां अलग है। लर्नर टेस्ट अब ऑनलाइन होता है, इसलिए यह बुकिंग स्क्रीन उसकी जगह है जो असल में मायने रखती है: ड्राइविंग टेस्ट, जो लर्नर लाइसेंस मिलने के तीस दिन बाद बुक होता है। नीचे का आवंटन दोनों हाल में असली है — एक स्लॉट, एक आवेदक, प्रूफ पेज पर प्रमाणित।')}</Note></div>
      {taken && <div style={{ marginBottom: 16 }}><Note tone="warn">{t('That time went to someone else.', 'वह समय किसी और को मिल गया।')} {t('It was taken while you were deciding. The times below are what is free right now — nobody is double-booked, and you have not lost your place in the application.', 'आप तय कर रहे थे तभी वह ले लिया गया। नीचे दिए समय अभी खाली हैं — किसी की दोहरी बुकिंग नहीं हुई, और आपका आवेदन जहां था वहीं है।')}</Note></div>}
      {error && !taken && <div style={{ marginBottom: 16 }}><Note tone="warn">{api.isOffline(error) ? t('The licence service is not responding, so no appointment can be held right now.', 'लाइसेंस सेवा जवाब नहीं दे रही, इसलिए अभी कोई अपॉइंटमेंट नहीं रखा जा सकता।') : error.message}</Note></div>}

      <div className="col g20">
        <div className="col g12"><span className="label">{t('Choose an office', 'एक कार्यालय चुनें', 'एक कार्यालय निवडा')}</span>
          {offices.map(o => (
            <Tile key={o.id} checked={officeId === o.id} onClick={() => { setOfficeId(o.id); setDay(null); setTime(null); setTaken(false); }} title={o.name}
              desc={t(`${o.area} · ${o.km} km away`, `${o.area} · ${o.km} किमी दूर`, `${o.area} · ${o.km} किमी दूर`)}
              right={<span className="col g6" style={{ alignItems: 'flex-end', flex: 'none' }}><Pill tone={o.load === 'light' ? 'ok' : 'warn'}>{o.load === 'light' ? t('Light day', 'हल्का दिन', 'कमी दिवस') : t('Busy', 'व्यस्त', 'व्यग्र')}</Pill><span className="tiny">{formatOfficeWait(o.waitMinutes, o.wait, lang)}</span></span>} />
          ))}
          {live && <span className="tiny">{t('Waiting times are read from each office as it stands now.', 'प्रतीक्षा समय हर कार्यालय से इस समय की स्थिति के अनुसार पढ़ा गया है।')}</span>}
        </div>

        <div className="card card-p col g16">
          <div className="row between g12 wrapf"><h3>{t('Pick a date', 'एक तारीख चुनें', 'एक तारीख निवडा')}</h3><span className="tiny row g6">{Icon.pin()} {office.name}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 10 }}>
            {days.map(d => (
              <button key={d.date} className="slot" aria-pressed={day === d.date} disabled={!d.left} onClick={() => { setDay(d.date); setTime(null); setTaken(false); }}>
                <span className="col g4"><b style={{ fontWeight: 600, fontSize: '.92rem' }}>{formatDayLabel(d.date, d.label, lang)}</b><span className="tiny" style={{ color: day === d.date ? 'oklch(0.92 0.03 262)' : undefined }}>{d.left ? t(`${d.left} left`, `${d.left} बचे`, `${d.left} शिल्लक`) : t('Full', 'भरा हुआ', 'भरलेले')}</span></span>
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
                {/* The day grid has always had an empty state and this one did
                    not, so a day whose times failed to load rendered as a
                    heading above a blank rectangle. */}
                {times.length === 0 && <span className="tiny">{t('No times came back for that day. Pick another date, or try again in a moment.', 'उस दिन के लिए कोई समय नहीं मिला। दूसरी तारीख चुनें, या थोड़ी देर बाद फिर देखें।')}</span>}
              </div>
              <span className="tiny">{t('Counts are the office\'s actual remaining capacity for that time, across its inspectors.', 'गिनती उस समय के लिए कार्यालय की असली बची क्षमता है, उसके सभी निरीक्षकों को मिलाकर।')}</span>
            </div>
          )}
        </div>

        {time && chosenDay && (
          <div className="card card-p col g14 fade">
            <Pill tone="brand">{t('Ready to confirm', 'पुष्टि के लिए तैयार', 'पुष्टीसाठी तयार')}</Pill>
            <h2>{formatDayLabel(chosenDay.date, chosenDay.label, lang)}, {time.time} · {office.name}</h2>
            {/* Two lines, not one run-on. The office's wait is its own sentence
                already ("Avg wait once you arrive: 10 min"), and splicing it
                lowercased onto the end of another one read as
                "…ten minutes early. avg wait once you arrive: 10 min." */}
            <p className="sub">{t('Bring the originals of your age and address proof, a print of the e-receipt and this appointment letter. Arrive ten minutes early.', 'अपने आयु और पता प्रमाण की मूल प्रति, ई-रसीद का प्रिंट और यह अपॉइंटमेंट लेटर लाएं। दस मिनट पहले पहुंचें।', 'तुमच्या वय आणि पत्ता पुराव्याची मूळ प्रत, ई-पावतीची प्रिंट आणि हे अपॉइंटमेंट लेटर आणा. दहा मिनिटे आधी पोहोचा.')}</p>
            <span className="tiny row g6">{Icon.clock()} {formatOfficeWait(office.waitMinutes, office.wait, lang)}</span>
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
