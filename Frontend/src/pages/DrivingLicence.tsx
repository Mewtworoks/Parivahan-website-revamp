import { useEffect, useState } from 'react';
import * as api from '../api';
import { formatDayLabel, formatOfficeWait, formatWait } from '../lib/format';
import { useIdentity } from '../lib/identity';
import { useLanguage, useT } from '../lib/language';
import { useAction, useApi, usePolling } from '../lib/useApi';
import { useOffices } from '../lib/useOffices';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill, Tile } from '../ui/SharedUI';

/**
 * The driving test: find the learner's licence, book the appointment, check in.
 *
 * This screen exists because the learner's test does not need one. It is taken
 * online, so the learner's journey ends at the test itself — and the
 * appointment, the inspector and the queue all belong here instead, thirty days
 * later, when the driving test is due.
 *
 * The booking attaches to the learner's application rather than to a new one.
 * That is the whole reason the live queue still works: check-in, the token, the
 * named inspector and the growing sealed ledger all hang off
 * `application.booking_id`, and a separate driving-licence record would have
 * left the learner's application frozen at "verified" with nothing after it.
 *
 * Nothing is typed. The citizen signed in, so the service already knows which
 * application is theirs — asking them to key in a licence number the service
 * issued is the failure this whole build argues against.
 */
export function DrivingLicence({ go, state, update }: PageProps) {
  const t = useT();
  const { lang } = useLanguage();
  const phone = useIdentity();

  // Resolved once, then polled. Same shape as the tracker: the one-shot lookup
  // answers 404 for somebody who has not applied, which is an ordinary state and
  // not worth re-asking every four seconds; the poll afterwards is what makes a
  // colleague advancing the queue at the office show up here without a reload.
  const [applicationId, setApplicationId] = useState<string | null>(state.applicationId || null);
  const { data: found, error: lookupError } = useApi(
    signal => api.citizenApplication(phone!, signal),
    [phone],
    Boolean(phone) && !applicationId,
  );
  useEffect(() => {
    if (found?.application_id) setApplicationId(found.application_id);
  }, [found?.application_id]);

  const { data: live, refresh } = usePolling(
    signal => api.getApplication(applicationId!, signal),
    { intervalMs: 4000, enabled: Boolean(applicationId), deps: [applicationId] },
  );
  const application = live || found;

  const { offices } = useOffices(application?.rto?.state);
  const [officeId, setOfficeId] = useState(application?.rto_id || '');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<api.SlotTime | null>(null);
  const [taken, setTaken] = useState(false);
  const { pending, error, run } = useAction();

  // Keep the selection valid when the office list arrives.
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
  const booking = application?.booking;
  const queue = application?.queue;
  const issued = application?.status === 'issued';

  const confirm = async () => {
    if (!time?.slot_id || !applicationId) return;
    setTaken(false);
    // Losing the race is the guarantee working, so it gets its own message and a
    // fresh list. Every other failure is a different sentence — a cold backend,
    // an appointment already held, a time that has passed — and reporting all
    // four the same way sent people hunting for another slot that would not book
    // either. Only the slot-taken 409 is caught here.
    let lost = false;
    const booked = await run('book', async () => {
      try {
        return await api.bookSlot(applicationId, time.slot_id!);
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 409 && /just taken/i.test(err.detail)) {
          lost = true;
          return null;
        }
        throw err;
      }
    });
    if (!booked) {
      if (lost) { setTaken(true); setTime(null); reloadTimes(); }
      return;
    }
    update({
      slot: {
        day: booked.label, time: booked.time, rto: office?.name || '',
        bookingId: booked.booking_id, tester: booked.tester || undefined,
      },
    });
    setTime(null);
    refresh();
  };

  const checkIn = async () => {
    const token = await run('checkin', () => api.checkIn(applicationId!));
    if (token) { update({ tokenId: token.token_id }); refresh(); }
  };

  const header = (
    <div className="col g10" style={{ marginBottom: 26 }}>
      <span className="eyebrow">{t('Driving licence', 'ड्राइविंग लाइसेंस', 'ड्रायव्हिंग लायसन्स')}</span>
      <h1>{t('Book your driving test', 'अपना ड्राइविंग टेस्ट बुक करें', 'तुमची ड्रायव्हिंग टेस्ट बुक करा')}</h1>
      <p className="lede">{t('This is the test that needs an appointment. You bring a vehicle, an inspector takes you out on the road, and the result is recorded the same day.', 'यही वह टेस्ट है जिसके लिए अपॉइंटमेंट चाहिए। आप वाहन लाते हैं, निरीक्षक आपको सड़क पर ले जाते हैं, और नतीजा उसी दिन दर्ज होता है।', 'हीच ती टेस्ट आहे जिच्यासाठी भेटीची वेळ लागते. तुम्ही वाहन आणता, निरीक्षक तुम्हाला रस्त्यावर नेतात, आणि निकाल त्याच दिवशी नोंदवला जातो.')}</p>
    </div>
  );

  // Signed in, but nothing filed. Mirrors the note the booking screen used to
  // carry for the same situation, and points at the one thing that fixes it.
  if (!application) {
    const missing = lookupError instanceof api.ApiError && lookupError.status === 404;
    return (
      <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
        {header}
        <Note tone={missing ? 'warn' : undefined}>
          {missing
            ? t("There is no learner's licence application under your number yet. The driving test is booked against it, so that comes first.", 'आपके नंबर पर अभी कोई लर्नर लाइसेंस आवेदन नहीं है। ड्राइविंग टेस्ट उसी के विरुद्ध बुक होता है, इसलिए पहले वह।')
            : t('Looking up your learner’s licence…', 'आपका लर्नर लाइसेंस खोजा जा रहा है…')}
        </Note>
        {missing && (
          <div className="row g10 wrapf" style={{ marginTop: 16 }}>
            <button className="btn btn-p" onClick={() => go('apply')}>{t("Apply for a learner's licence", 'लर्नर लाइसेंस के लिए आवेदन करें')} {Icon.right()}</button>
            <button className="btn btn-s" onClick={() => go('status')}>{t('Track an application', 'एक आवेदन ट्रैक करें')}</button>
          </div>
        )}
        <div style={{ height: 56 }} />
      </div>
    );
  }

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      {header}

      {/* Fetched, not typed. The number, the holder and the classes are read
          back off the record so the citizen can check this is their licence
          before booking anything against it. */}
      <div className="card card-p col g14" style={{ marginBottom: 16 }}>
        <div className="row between g12 wrapf">
          <h3>{t("Your learner's licence", 'आपका लर्नर लाइसेंस', 'तुमचे लर्नर लायसन्स')}</h3>
          <Pill tone={issued ? 'ok' : 'warn'}>{issued
            ? t('Issued', 'जारी', 'जारी')
            : t('Test not passed yet', 'टेस्ट अभी पास नहीं', 'टेस्ट अजून पास नाही')}</Pill>
        </div>
        <dl className="kv">
          <dt>{t('Application', 'आवेदन', 'अर्ज')}</dt><dd className="mono">{application.application_no}</dd>
          <dt>{t('Holder', 'धारक', 'धारक')}</dt><dd>{application.applicant_name || '—'}</dd>
          <dt>{t('Classes', 'श्रेणियां', 'वर्ग')}</dt><dd>{application.licence_classes?.join(', ') || '—'}</dd>
        </dl>
      </div>

      {/* The rule, said rather than enforced. There is no issue date on the
          record to count thirty days from, and inventing a countdown is what
          the parked version of this screen did — a progress bar reading "Day 1
          of 30" that was the same on every visit. */}
      <div style={{ marginBottom: 16 }}><Note>
        {issued
          ? t('In the live service the driving test can be booked from thirty days after your learner’s licence is issued, and within six months of it. This prototype does not hold you to the wait.', 'असली सेवा में ड्राइविंग टेस्ट लर्नर लाइसेंस मिलने के तीस दिन बाद से, और छह महीने के भीतर बुक किया जा सकता है। यह प्रोटोटाइप आपको उस इंतज़ार में नहीं रोकता।')
          : t('In the live service you would take the learner’s test online first, and book this thirty days after the licence is issued. This prototype lets you look at the booking either way, because the allocation underneath is the part worth showing.', 'असली सेवा में आप पहले लर्नर टेस्ट ऑनलाइन देते, और लाइसेंस मिलने के तीस दिन बाद यह बुक करते। यह प्रोटोटाइप आपको दोनों हाल में बुकिंग देखने देता है, क्योंकि नीचे का आवंटन ही दिखाने लायक हिस्सा है।')}
      </Note></div>

      {taken && <div style={{ marginBottom: 16 }}><Note tone="warn" live>{t('That time went to someone else.', 'वह समय किसी और को मिल गया।')} {t('It was taken while you were deciding. The times below are what is free right now — nobody is double-booked.', 'आप तय कर रहे थे तभी वह ले लिया गया। नीचे दिए समय अभी खाली हैं — किसी की दोहरी बुकिंग नहीं हुई।')}</Note></div>}
      {error && !taken && pending !== 'checkin' && <div style={{ marginBottom: 16 }}><Note tone="warn" live>{api.isOffline(error)
        ? t('The licence service is not responding, so no appointment can be held right now.', 'लाइसेंस सेवा जवाब नहीं दे रही, इसलिए अभी कोई अपॉइंटमेंट नहीं रखा जा सकता।')
        : error.message}</Note></div>}

      {booking ? (
        <div className="col g16">
          <div className="card card-p col g14">
            <Pill tone="ok">{Icon.check()} {t('Appointment held', 'अपॉइंटमेंट सुरक्षित', 'भेटीची वेळ राखीव')}</Pill>
            <h2 style={{ margin: 0 }}>{formatDayLabel(booking.date, booking.label, lang)}, {booking.time}</h2>
            <dl className="kv">
              <dt>{t('Booking reference', 'बुकिंग संदर्भ', 'बुकिंग संदर्भ')}</dt><dd className="mono">{booking.booking_id}</dd>
              <dt>{t('Office', 'कार्यालय', 'कार्यालय')}</dt><dd>{application.rto?.name || '—'}</dd>
            </dl>
            <hr className="hr" />
            <p className="sub">{t('Bring the vehicle you are being tested on, with valid registration, insurance and PUC — the RTO does not provide one. Bring your learner’s licence and this reference, and arrive ten minutes early.', 'जिस वाहन पर टेस्ट देना है उसे लाएं, वैध पंजीकरण, बीमा और PUC के साथ — आरटीओ वाहन नहीं देता। अपना लर्नर लाइसेंस और यह संदर्भ लाएं, और दस मिनट पहले पहुंचें।')}</p>
          </div>

          {/* On the day: the token, the named inspector, and a wait that moves.
              Lives here rather than on the tracker now, because this is the
              appointment it belongs to. */}
          <div className="card card-p col g14">
            <div className="row between g12 wrapf">
              <h3>{t('On the day', 'टेस्ट के दिन', 'टेस्टच्या दिवशी')}</h3>
              {queue && <Pill tone={queue.status === 'in_test' ? 'warn' : 'brand'}>{queue.status === 'in_test' ? t('Your turn now', 'अब आपकी बारी') : t('Waiting', 'प्रतीक्षा में')}</Pill>}
            </div>
            {!queue ? (
              <>
                <p className="sub">{t('When you reach the office, check in here. You get a token number and a named inspector, and the wait stops being a guess — you can sit down instead of standing in a line.', 'कार्यालय पहुंचने पर यहीं चेक-इन करें। आपको टोकन नंबर और नामित निरीक्षक मिलता है, और प्रतीक्षा अनुमान नहीं रहती — आप कतार में खड़े होने के बजाय बैठ सकते हैं।')}</p>
                <div><button className="btn btn-p" disabled={pending === 'checkin'} onClick={() => void checkIn()}>{pending === 'checkin' ? t('Checking in…', 'चेक-इन हो रहा है…') : t('I have reached the office', 'मैं कार्यालय पहुंच गया हूं')} {Icon.right()}</button></div>
                {/* Reported here rather than nowhere. This button is pressed
                    while standing inside the office, which is the worst place on
                    the whole journey to be told nothing. */}
                {error && pending !== 'checkin' && <Note tone="warn" live>{api.isOffline(error)
                  ? t('The licence service is not responding, so you could not be checked in. Try again in a moment — your appointment is still held.', 'लाइसेंस सेवा जवाब नहीं दे रही, इसलिए चेक-इन नहीं हो सका। थोड़ी देर बाद फिर कोशिश करें — आपका अपॉइंटमेंट सुरक्षित है।')
                  : error.message}</Note>}
              </>
            ) : (
              <>
                <div className="grid2" style={{ gap: 16 }}>
                  {/* The token is issued across the whole office; the line is per
                      inspector. Labelling it plainly stops "token 3" reading as a
                      position and contradicting "nobody is ahead of you". */}
                  <div className="col g4"><span className="tiny" style={{ fontWeight: 600 }}>{t('Your token · called across the hall', 'आपका टोकन · पूरे हॉल में बुलाया जाता है')}</span><b className="mono" style={{ fontSize: '1.6rem' }}>{queue.token_number}</b></div>
                  <div className="col g4"><span className="tiny" style={{ fontWeight: 600 }}>{t('Your inspector', 'आपके निरीक्षक')}</span><b style={{ fontWeight: 600 }}>{queue.tester}</b></div>
                </div>
                <hr className="hr" />
                <div className="row between g12 wrapf">
                  <span className="sub">{queue.people_ahead === 0
                    ? t(`You are next with ${queue.tester}.`, `आप ${queue.tester} के साथ अगले हैं।`)
                    : t(`${queue.people_ahead} ahead of you in ${queue.tester}'s line.`, `${queue.tester} की कतार में आपसे आगे ${queue.people_ahead} लोग।`)}</span>
                  <b style={{ fontWeight: 600 }}>{formatWait(queue.eta_minutes, lang)}</b>
                </div>
                <span className="tiny">{t('Recalculated from your inspector\'s own pace every few seconds, and it is the same number shown on the hall display. The official portal shows you nothing at all here.', 'आपके निरीक्षक की गति से हर कुछ सेकंड में फिर से गणना की जाती है, और यही नंबर हॉल डिस्प्ले पर दिखता है। आधिकारिक पोर्टल यहां कुछ भी नहीं दिखाता।')}</span>
                {/* Sits here rather than in the top bar because the claim only
                    means anything when both screens are open: advance the lane on
                    the desk and this wait changes while you watch it. */}
                <div>
                  <button className="btn btn-s btn-sm" onClick={() => go('desk')}>
                    {t('Open the inspector desk', 'निरीक्षक डेस्क खोलें')} {Icon.right()}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="col g20">
          <div className="col g12"><span className="label">{t('Choose a test track', 'एक टेस्ट ट्रैक चुनें', 'एक टेस्ट ट्रॅक निवडा')}</span>
            {offices.map(o => (
              <Tile key={o.id} checked={officeId === o.id} onClick={() => { setOfficeId(o.id); setDay(null); setTime(null); setTaken(false); }} title={o.name}
                desc={t(`${o.area} · ${o.km} km away`, `${o.area} · ${o.km} किमी दूर`, `${o.area} · ${o.km} किमी दूर`)}
                right={<span className="col g6" style={{ alignItems: 'flex-end', flex: 'none' }}><Pill tone={o.load === 'light' ? 'ok' : 'warn'}>{o.load === 'light' ? t('Light day', 'हल्का दिन', 'कमी दिवस') : t('Busy', 'व्यस्त', 'व्यग्र')}</Pill><span className="tiny">{formatOfficeWait(o.waitMinutes, o.wait, lang)}</span></span>} />
            ))}
          </div>

          <div className="card card-p col g16">
            <div className="row between g12 wrapf"><h3>{t('Pick a date', 'एक तारीख चुनें', 'एक तारीख निवडा')}</h3>{office && <span className="tiny row g6">{Icon.pin()} {office.name}</span>}</div>
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
                  {times.length === 0 && <span className="tiny">{t('No times came back for that day. Pick another date, or try again in a moment.', 'उस दिन के लिए कोई समय नहीं मिला। दूसरी तारीख चुनें, या थोड़ी देर बाद फिर देखें।')}</span>}
                </div>
                <span className="tiny">{t('Counts are the office\'s actual remaining capacity for that time, across its inspectors.', 'गिनती उस समय के लिए कार्यालय की असली बची क्षमता है, उसके सभी निरीक्षकों को मिलाकर।')}</span>
              </div>
            )}
          </div>

          {time && chosenDay && office && (
            <div className="card card-p col g14 fade">
              <Pill tone="brand">{t('Ready to confirm', 'पुष्टि के लिए तैयार', 'पुष्टीसाठी तयार')}</Pill>
              <h2>{formatDayLabel(chosenDay.date, chosenDay.label, lang)}, {time.time} · {office.name}</h2>
              <p className="sub">{t('Bring the vehicle you are being tested on, with valid registration, insurance and PUC. Driving schools near the office rent one with an instructor for the slot if you do not own one.', 'जिस वाहन पर टेस्ट देना है उसे लाएं, वैध पंजीकरण, बीमा और PUC के साथ। यदि आपके पास वाहन नहीं है तो कार्यालय के पास ड्राइविंग स्कूल इंस्ट्रक्टर के साथ किराए पर देते हैं।')}</p>
              <span className="tiny row g6">{Icon.clock()} {formatOfficeWait(office.waitMinutes, office.wait, lang)}</span>
              <div className="row g12 wrapf">
                <button className="btn btn-p" disabled={pending === 'book'} onClick={() => void confirm()}>{pending === 'book' ? t('Holding the slot…', 'स्लॉट रखा जा रहा है…') : t('Confirm this appointment', 'यह अपॉइंटमेंट पक्का करें', 'ही भेटीची वेळ निश्चित करा')} {Icon.right()}</button>
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ height: 56 }} />
    </div>
  );
}
