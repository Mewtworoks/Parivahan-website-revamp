import { useEffect, useState } from 'react';
import * as api from '../api';
import { CLASSES } from '../data/vehicleClasses';
import { formatDay, formatTime, formatWait } from '../lib/format';
import { prettyPhone, useIdentity } from '../lib/identity';
import { useLanguage, useT } from '../lib/language';
import { useAction, useApi, usePolling } from '../lib/useApi';
import { TODAY_ISO } from '../lib/validate';
import type { PageProps } from '../types';
import { DocLinks } from '../ui/DocLinks';
import { Icon } from '../ui/Icon';
import { Field, Input, Note, Pill } from '../ui/SharedUI';
import { StageTable } from '../ui/StageTable';

/** Plain-language meaning of each state the service can record. */
const STATUS_COPY: Record<api.AppStatusValue, [en: string, hi: string]> = {
  submitted: ['Received', 'प्राप्त हुआ'],
  verified: ['Documents verified', 'दस्तावेज़ सत्यापित'],
  issued: ["Learner's licence issued", 'लर्नर लाइसेंस जारी'],
  slot_booked: ['Appointment held', 'अपॉइंटमेंट तय'],
  checked_in: ['At the office, in the queue', 'कार्यालय में, कतार में'],
  completed: ['Test done', 'टेस्ट पूरा'],
  rejected: ['Returned for correction', 'सुधार के लिए वापस'],
};

/** Application tracker — look up an application number + DOB, see every stage and what's next. */
export function Status({ go, state, update }: PageProps) {
  const t = useT();
  const { lang } = useLanguage();
  const form = state.form || {};
  const ownApplication = Boolean(state.applicationId);

  const [applicationNo, setApplicationNo] = useState(state.app?.no || '');
  const [dob, setDob] = useState(ownApplication ? (form.dob || '') : '');
  const [lookupId, setLookupId] = useState<string | null>(state.applicationId || null);
  const [notFound, setNotFound] = useState(false);
  const [mine, setMine] = useState(false);
  // Named apart from the polling error below, which is a different failure with
  // different copy. Dropping this one meant a failed check-in — pressed while
  // standing in the office — greyed the button, un-greyed it, and said nothing
  // at all.
  const { pending, error: actionError, run } = useAction();
  const phone = useIdentity();

  useEffect(() => {
    if (state.applicationId) setLookupId(state.applicationId);
  }, [state.applicationId]);

  // Signed in, so the application is already known — ask for it by number
  // instead of asking the citizen to type the number.
  //
  // Saarthi has read this record back by name on the panel beside this screen,
  // and the tracker was still presenting an empty two-field lookup: the same
  // service, in the same tab, for the same person, pretending not to know who
  // they were. The lookup stays below for everyone else — somebody checking on
  // a relative's application has the slip, not the phone it was filed from.
  useEffect(() => {
    if (!phone || state.applicationId) return;
    let dropped = false;
    void (async () => {
      try {
        const found = await api.citizenApplication(phone);
        if (dropped) return;
        setMine(true);
        setLookupId(found.application_id);
        setApplicationNo(found.application_no);
        if (found.dob) setDob(found.dob);
        update({ applicationId: found.application_id });
      } catch {
        // A 404 is the ordinary case: signed in, nothing applied for yet.
      }
    })();
    return () => { dropped = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, state.applicationId]);

  // The application as the service holds it. Repolled so a colleague advancing
  // the queue at the office shows up here without a reload.
  const { data: application, error, refresh } = usePolling(
    signal => api.getApplication(lookupId!, signal),
    { intervalMs: 4000, enabled: Boolean(lookupId), deps: [lookupId] },
  );

  const { data: receipt } = useApi(
    signal => api.getReceipt(lookupId!, signal),
    [lookupId, application?.status],
    Boolean(lookupId),
  );

  // Show the date of birth the application was filed with, so the two lookup
  // fields are not left half-filled when arriving from the journey itself.
  useEffect(() => {
    if (!dob && application?.dob) setDob(application.dob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.dob]);

  const find = async () => {
    setNotFound(false);
    // Only a 404 means "no application matches". Everything else — the service
    // asleep, a network drop — used to land on the same message, which told
    // somebody their number and date of birth did not match when in fact
    // nothing had been checked at all.
    let missed = false;
    const found = await run('find', async () => {
      try {
        return await api.findApplication(applicationNo.trim(), dob);
      } catch (err) {
        if (err instanceof api.ApiError && err.status === 404) { missed = true; return null; }
        throw err;
      }
    });
    if (!found) { if (missed) setNotFound(true); return; }
    setLookupId(found.application_id);
    update({ applicationId: found.application_id });
  };

  const checkIn = async () => {
    const token = await run('checkin', () => api.checkIn(lookupId!));
    if (token) { update({ tokenId: token.token_id }); refresh(); }
    // A failure leaves `actionError` set and is reported beside the button. The
    // service answers 400 here when there is no booking to check in against,
    // and that sentence is worth showing verbatim.
  };

  const queue = application?.queue;
  const found = Boolean(application);
  const isAadhaar = form.route === 'aadhaar';
  // An em dash, never the sample applicant. This screen exists to say what the
  // record holds, so falling back to a fixture put somebody else's name — and
  // somebody else's vehicle classes — on an application that had merely come
  // back with the field empty. A blank is the truth; "Rehan Q. Mirza" is not.
  const applicantName = application?.applicant_name || [form.first, form.last].filter(Boolean).join(' ') || '—';
  const classCodes = (application?.licence_classes?.length ? application.licence_classes : (form.classes || []).map(id => CLASSES.find(c => c.id === id)?.code).filter(Boolean) as string[]).join(', ') || '—';
  const rtoName = application?.rto?.name || '—';

  /**
   * Whether a test appointment is already held.
   *
   * The record is the authority, because the record is what this page is
   * displaying: keying this off the local journey instead put "no slot booked"
   * on the same screen as an "Appointment held" pill for the same application.
   * The local journey stays as a fallback for the gap between booking a slot and
   * the next poll returning it.
   */
  const booked = application?.status === 'slot_booked'
    || application?.status === 'checked_in'
    || Boolean(application?.booking_id)
    || Boolean(state.slot);

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('home')}>{Icon.left()} {t('Home', 'होम', 'होम')}</button>
      <div className="col g10" style={{ marginBottom: 26 }}>
        <span className="eyebrow">{t('Track an application', 'एक आवेदन ट्रैक करें', 'एक अर्ज ट्रॅक करा')}</span>
        <h1>{t('Where your application is', 'आपका आवेदन कहां है', 'तुमचा अर्ज कुठे आहे')}</h1>
        <p className="lede">{t('The official portal asks for your application number, your date of birth and a captcha, then shows a table of stage names. Same two inputs, no captcha, and each stage says what it means for you.', 'आधिकारिक पोर्टल आपका आवेदन नंबर, जन्म तिथि और एक कैप्चा मांगता है, फिर चरण नामों की एक तालिका दिखाता है। वही दो इनपुट, कोई कैप्चा नहीं, और हर चरण बताता है कि आपके लिए इसका क्या मतलब है।', 'अधिकृत पोर्टल तुमचा अर्ज क्रमांक, जन्मतारीख आणि एक कॅप्चा मागते, नंतर टप्प्यांच्या नावांचा तक्ता दाखवते. तेच दोन इनपुट, कॅप्चा नाही, आणि प्रत्येक टप्पा सांगतो की तुमच्यासाठी त्याचा अर्थ काय आहे.')}</p>
      </div>
      {/* Said before the two empty boxes below it, not after: somebody signed in
          who can already see their application does not need to work out that
          the form is for looking up somebody else's. */}
      {mine && phone && (
        <Note tone="ok" icon={Icon.check()}>
          {t(`Showing the application filed under ${prettyPhone(phone)}.`,
            `${prettyPhone(phone)} पर दर्ज आवेदन दिखाया जा रहा है।`)}{' '}
          <span className="tiny">
            {t('Enter a different number and date of birth below to look up another one.',
              'दूसरा आवेदन देखने के लिए नीचे अलग नंबर और जन्म तिथि डालिए।')}
          </span>
        </Note>
      )}

      <div className="card card-p col g16" style={mine ? { marginTop: 14 } : undefined}>
        <div className="grid2">
          <Field label={t('Application number', 'आवेदन नंबर', 'अर्ज क्रमांक')}><Input className="input mono" placeholder="SS-2026-004182" value={applicationNo} onChange={e => setApplicationNo(e.target.value)} /></Field>
          <Field label={t('Date of birth', 'जन्म तिथि', 'जन्मतारीख')}><Input type="date" max={TODAY_ISO} value={dob} onChange={e => setDob(e.target.value)} /></Field>
        </div>
        <div className="row g10 wrapf">
          <button className="btn btn-s" disabled={!applicationNo || !dob || pending === 'find'} onClick={() => void find()}>{Icon.search()} {pending === 'find' ? t('Looking…', 'खोज रहे हैं…') : t('Find my application', 'मेरा आवेदन खोजें', 'माझा अर्ज शोधा')}</button>
          {!ownApplication && <span className="tiny" style={{ alignSelf: 'center' }}>{t('Use the number from your slip, with the date of birth on the application.', 'अपनी पर्ची का नंबर और आवेदन में दी जन्म तिथि इस्तेमाल करें।')}</span>}
        </div>
        {notFound && <Note tone="warn">{t('Nothing matches that number and date of birth together. The number alone is never enough — that is deliberate, so an application cannot be read by anyone who happens to know it.', 'उस नंबर और जन्म तिथि का कोई मेल नहीं। केवल नंबर कभी पर्याप्त नहीं है — यह जानबूझकर है, ताकि कोई भी जिसे नंबर पता हो, आवेदन न देख सके।')}</Note>}
        {actionError && pending !== 'find' && !notFound && <Note tone="warn" live>{api.isOffline(actionError)
          ? t('The licence service is not responding, so nothing could be looked up. Nothing you typed has been lost — press Find again when it is back.', 'लाइसेंस सेवा जवाब नहीं दे रही, इसलिए कुछ भी खोजा नहीं जा सका। आपने जो टाइप किया वह सुरक्षित है — सेवा वापस आने पर फिर से खोजें दबाएं।')
          : actionError.message}</Note>}
        {error && api.isOffline(error) && <Note tone="warn">{t('The licence service is not responding, so live status cannot be shown.', 'लाइसेंस सेवा जवाब नहीं दे रही, इसलिए लाइव स्थिति नहीं दिखाई जा सकती।')}</Note>}
      </div>

      {found && application && (
        <div className="col g16 fade" style={{ marginTop: 16 }}>
          <div className="card card-p col g16">
            <div className="row between g16 wrapf" style={{ alignItems: 'flex-start' }}>
              <dl className="kv grow" style={{ minWidth: 230 }}>
                <dt>{t('Application', 'आवेदन', 'अर्ज')}</dt><dd className="mono">{application.application_no}</dd>
                <dt>{t('Applied on', 'आवेदन तिथि', 'अर्ज तारीख')}</dt><dd>{formatDay(application.created_at, lang)}</dd>
                <dt>{t('Applicant', 'आवेदक', 'अर्जदार')}</dt><dd>{applicantName}</dd><dt>{t('Service', 'सेवा', 'सेवा')}</dt><dd>{t("Issue of learner's licence", 'लर्नर लाइसेंस जारी करना', 'लर्नर लायसन्स जारी करणे')}</dd>
                <dt>{t('Classes', 'श्रेणियां', 'वर्ग')}</dt><dd>{classCodes}</dd><dt>{t('RTO', 'आरटीओ', 'आरटीओ')}</dt><dd>{rtoName}</dd>
                <dt>{t('Route', 'रास्ता', 'मार्ग')}</dt><dd>{isAadhaar ? t('Aadhaar e-KYC · faceless', 'आधार e-KYC · फेसलेस', 'आधार e-KYC · फेसलेस') : t('Without Aadhaar', 'आधार के बिना', 'आधारशिवाय')}</dd>
              </dl>
              <div className="col g8" style={{ flex: 'none', alignItems: 'center' }}>
                <div className="stripe" style={{ width: 88, height: 106, borderRadius: 8, border: '1px solid var(--line)' }} />
                <Pill tone={application.status === 'completed' ? 'ok' : 'brand'}>{t(...STATUS_COPY[application.status])}</Pill>
              </div>
            </div>
            {application.booking && (
              <Note tone="brand" icon={Icon.pin()}>{t('Appointment held', 'अपॉइंटमेंट तय')}: {application.booking.label}, {application.booking.time} · {rtoName}</Note>
            )}
            {isAadhaar && <Note tone="ok" icon={Icon.check()}>{t('Submitted for contactless service.', 'संपर्क रहित सेवा के लिए जमा किया गया।', 'संपर्करहित सेवेसाठी सादर केले.')} {t('No visit to the RTO office is needed for this application.', 'इस आवेदन के लिए आरटीओ कार्यालय जाने की ज़रूरत नहीं है।', 'या अर्जासाठी आरटीओ कार्यालयात जाण्याची गरज नाही.')}</Note>}
            <hr className="hr" />
            <DocLinks />
          </div>

          {/* On the day: the token, the named inspector, and a wait that moves. */}
          {application.booking && !isAadhaar && (
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
                      while standing inside the office, which is the worst place
                      on the whole journey to be told nothing. */}
                  {actionError && pending !== 'checkin' && <Note tone="warn" live>{api.isOffline(actionError)
                    ? t('The licence service is not responding, so you could not be checked in. Try again in a moment — your appointment is still held.', 'लाइसेंस सेवा जवाब नहीं दे रही, इसलिए चेक-इन नहीं हो सका। थोड़ी देर बाद फिर कोशिश करें — आपका अपॉइंटमेंट सुरक्षित है।')
                    : actionError.message}</Note>}
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
                      means anything when both screens are open: advance the lane
                      on the desk and this wait changes while you watch it. */}
                  <div>
                    <button className="btn btn-s btn-sm" onClick={() => go('desk')}>
                      {t('Open the inspector desk', 'निरीक्षक डेस्क खोलें')} {Icon.right()}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <StageTable state={state} go={go} />

          {/* What the service itself recorded, in order, sealed. */}
          {receipt && (
            <div className="card card-p col g12">
              <div className="row between g12 wrapf">
                <h3>{t('Recorded by the service', 'सेवा द्वारा दर्ज')}</h3>
                <Pill tone={receipt.chain_valid ? 'ok' : 'warn'}>{receipt.chain_valid ? t('Record intact', 'रिकॉर्ड सुरक्षित') : t('Record altered', 'रिकॉर्ड बदला गया')}</Pill>
              </div>
              <div className="col g8">
                {application.ledger.map(ev => (
                  <div key={ev.seq} className="row g12" style={{ alignItems: 'flex-start' }}>
                    <span className="rail-n" style={{ flex: 'none' }}>{ev.seq + 1}</span>
                    <span className="col g4 grow" style={{ minWidth: 0 }}>
                      <b style={{ fontWeight: 600, fontSize: '.93rem' }}>{t(...STATUS_COPY[ev.status])}</b>
                      <span className="tiny">{ev.note} · {formatTime(ev.at, lang)}</span>
                    </span>
                  </div>
                ))}
              </div>
              <span className="tiny">{t('Each line is sealed with the fingerprint of the line above it, so this history cannot be edited after the fact without the seal breaking.', 'हर पंक्ति अपने ऊपर वाली पंक्ति की पहचान से सील है, इसलिए बाद में इस इतिहास को बदला नहीं जा सकता बिना सील टूटे।')}</span>
            </div>
          )}

          <div className="card card-p col g12">
            <h3>{t('Test result and allotment', 'टेस्ट परिणाम और आवंटन', 'टेस्ट निकाल आणि वाटप')}</h3>
            {state.stage === 'issued'
              ? <div className="row between g12 wrapf"><span className="sub">{t('Recording LL test results', 'LL टेस्ट परिणाम दर्ज करना', 'LL टेस्ट निकाल नोंदवणे')}</span><Pill tone="ok">{t('Passed · licence generated', 'पास · लाइसेंस बना', 'उत्तीर्ण · लायसन्स तयार')}</Pill></div>
              : (
                <>
                  <div className="row between g12 wrapf">
                    <span className="sub">{t('Recording LL test results', 'LL टेस्ट परिणाम दर्ज करना')}</span>
                    <Pill>{booked
                      ? t('Appointment held — test pending', 'अपॉइंटमेंट तय — टेस्ट लंबित')
                      : t('Not yet — no slot booked', 'अभी नहीं — कोई स्लॉट बुक नहीं')}</Pill>
                  </div>

                  {/* The way out, on the screen that says a step is pending.
                      This card's own closing line promises to say "what is
                      actually pending and what unblocks it" — and it said the
                      first half and stopped, so somebody tracking an application
                      read "test pending" and had nowhere to go. The official
                      portal's failure quoted just below is that it tells you
                      nothing; telling you something and then leaving you on a
                      dead end is not much better.

                      Which button shows depends on where the journey actually
                      is: with no appointment the next move is booking one, with
                      one held it is sitting the test. Practice is offered beside
                      either, because it is the only thing here that changes the
                      outcome and it costs nothing to try. */}
                  <div className="col g8">
                    <span className="sub">
                      {booked
                        ? t('The appointment is held. Passing the test is the last thing between you and the licence.',
                          'अपॉइंटमेंट तय है। लाइसेंस से पहले टेस्ट पास करना ही आखिरी कदम है।')
                        : t('Nothing is stuck. The next move is yours — take the test online, and this line fills itself in once you have.',
                          'कुछ अटका नहीं है। अगला कदम आपका है — ऑनलाइन टेस्ट दीजिए, और देने पर यह पंक्ति खुद भर जाएगी।')}
                    </span>
                    <div className="row g10 wrapf">
                      {/* The test, either way. Booking is no longer a step in
                          this journey — the learner's test is online — so the
                          only thing left to offer is the test itself. */}
                      <button className="btn btn-p btn-sm" onClick={() => go('test')}>
                        {t('Take the test', 'टेस्ट दें')} {Icon.right()}
                      </button>
                      <button className="btn btn-s btn-sm" onClick={() => go('learn')}>
                        {t('Practise first', 'पहले अभ्यास करें')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            <span className="tiny">{t('The official portal shows this as a Counter column reading "Allotment Information Unavailable", which tells you nothing. Here it says what is actually pending and what unblocks it.', 'आधिकारिक पोर्टल इसे एक Counter कॉलम में "Allotment Information Unavailable" के रूप में दिखाता है, जो कुछ नहीं बताता। यहां बताया जाता है कि वास्तव में क्या लंबित है और उसे क्या खोलता है।', 'अधिकृत पोर्टल हे एका Counter स्तंभात "Allotment Information Unavailable" असे दाखवते, जे काहीही सांगत नाही. इथे सांगितले जाते की प्रत्यक्षात काय प्रलंबित आहे आणि ते काय उघडते.')}</span>
          </div>
          <Note>{t('If a stage is ever Reverted on the real portal it means a document was rejected, and the reason is a code. Here it would say which document, what was wrong with it, and give you the one button that fixes it.', 'यदि असली पोर्टल पर कोई चरण कभी Reverted होता है तो इसका मतलब है कि एक दस्तावेज़ रद्द हुआ, और कारण एक कोड है। यहां बताया जाता कि कौन सा दस्तावेज़, उसमें क्या गलत था, और इसे ठीक करने वाला एक बटन दिया जाता।', 'खऱ्या पोर्टलवर एखादा टप्पा कधी Reverted झाला तर याचा अर्थ एक कागदपत्र नाकारले गेले, आणि कारण एक कोड आहे. इथे कोणते कागदपत्र, त्यात काय चुकीचे होते, आणि ते दुरुस्त करणारे एक बटण दिले जाईल.')}</Note>
        </div>
      )}
      <div style={{ height: 56 }} />
    </div>
  );
}
