import { useEffect, useRef } from 'react';
import * as api from '../api';
import { feeRows, feeTotal, inWords, inWordsHi } from '../data/fees';
import { rtosFor } from '../data/rtoOffices';
import { AUTO_READ_DELAY, autoScrollToBottom, autoWait } from '../lib/autoDemo';
import { formatDayTime } from '../lib/format';
import { useLanguage, useT } from '../lib/language';
import { useApi } from '../lib/useApi';
import type { PageProps } from '../types';
import { DocLinks } from '../ui/DocLinks';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';

/** e-Receipt shown right after a (mock) payment confirms. */
export function Receipt({ go, state, update }: PageProps) {
  const t = useT();
  const { lang } = useLanguage();
  const form = state.form || {};
  const classIds = form.classes || ['MCWG'];
  const isAadhaar = form.route === 'aadhaar';
  const stateName = form.state || 'Maharashtra';
  const rows = feeRows(classIds, stateName);
  const total = feeTotal(classIds, stateName);
  const office = rtosFor(stateName).find(r => r.id === form.rto) || rtosFor(stateName)[0];
  const applicationNo = state.app?.no || '—';

  // The sealed journey record behind this receipt. Each entry carries the
  // fingerprint of the one before it, so a rewritten history stops verifying.
  const { data: receipt } = useApi(
    signal => api.getReceipt(state.applicationId!, signal),
    [state.applicationId],
    Boolean(state.applicationId),
  );

  const ran = useRef(false);
  useEffect(() => {
    if (state.autoDemo !== 'll' || ran.current) return;
    ran.current = true;
    void (async () => {
      await autoWait();
      await autoScrollToBottom();
      await autoWait(AUTO_READ_DELAY);
      if (isAadhaar) { update({ stage: 'booked' }); go('tutorial'); } else { go('slot'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.autoDemo]);

  return (
    <div className="narrow fade" style={{ padding: '56px 24px 0' }}>
      <div className="col g16" style={{ alignItems: 'flex-start' }}>
        <span style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--ok-soft)', color: 'var(--ok)', display: 'grid', placeItems: 'center', border: '1px solid var(--brand-line)' }}>{Icon.check({ width: 22, height: 22 })}</span>
        <h1>{t('Paid and verified.', 'भुगतान हो गया और सत्यापित।', 'पैसे भरले आणि पडताळणी झाली.')}</h1>
        <p className="lede">{isAadhaar ? t('Slot booking is exempt for you. The next thing is the test itself, taken wherever you are.', 'स्लॉट बुकिंग आपके लिए छूट में है। अगली चीज़ है टेस्ट खुद, जहां भी आप हों वहीं से।', 'स्लॉट बुकिंग तुमच्यासाठी सूट आहे. पुढील गोष्ट म्हणजे टेस्ट स्वतः, तुम्ही कुठेही असाल तिथूनच.') : t('Next: book the slot for your test at the office.', 'अगला: कार्यालय में अपने टेस्ट के लिए स्लॉट बुक करें।', 'पुढील: कार्यालयात तुमच्या टेस्टसाठी स्लॉट बुक करा.')}</p>
      </div>
      <div className="card card-p col g14" style={{ marginTop: 26 }}>
        <div className="row between g12 wrapf"><h3>{t('e-Receipt', 'ई-रसीद', 'ई-पावती')}</h3><Pill tone="ok">{t('Confirmed by the bank', 'बैंक द्वारा पुष्टि की गई', 'बँकेने पुष्टी केली')}</Pill></div>
        <dl className="kv"><dt>{t('Receipt number', 'रसीद नंबर', 'पावती क्रमांक')}</dt><dd className="mono">{applicationNo.replace(/^SS-\d{4}-/, 'SS-RCPT-')}</dd><dt>{t('Application', 'आवेदन', 'अर्ज')}</dt><dd className="mono">{applicationNo}</dd>
          <dt>{t('Paid on', 'भुगतान तिथि', 'पैसे भरल्याची तारीख')}</dt><dd>{formatDayTime(state.app?.submittedAt, lang)}</dd><dt>{t('Gateway', 'गेटवे', 'गेटवे')}</dt><dd>{t('Multi-bank · mock', 'मल्टी-बैंक · नकली', 'मल्टी-बँक · नकली')}</dd>
          <dt>{t('Office', 'कार्यालय', 'कार्यालय')}</dt><dd>{office.name}</dd></dl>
        <hr className="hr" />
        {rows.map((row, i) => <div key={i} className="row between g16"><span className="sub">{t(row.k, row.kHi, row.kMr)}</span><b className="mono" style={{ fontWeight: 600 }}>₹{row.v}</b></div>)}
        <hr className="hr" />
        <div className="row between g16"><b>{t('Total', 'कुल', 'एकूण')}</b><b className="mono" style={{ fontSize: '1.1rem' }}>₹{total}</b></div>
        <span className="tiny">{lang === 'en' ? inWords(total) : inWordsHi(total)}</span>
        <hr className="hr" />
        <div className="row g10 wrapf"><button className="btn btn-s btn-sm">{Icon.doc()} {t('Download e-receipt', 'ई-रसीद डाउनलोड करें', 'ई-पावती डाउनलोड करा')}</button><button className="btn btn-s btn-sm">{t('Email to me', 'मुझे ईमेल करें', 'मला ईमेल करा')}</button></div>
        <hr className="hr" />
        {receipt && (
          <div className="flat col g10" style={{ padding: '14px 16px' }}>
            <div className="row between g12 wrapf">
              <span className="tiny" style={{ fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{t('Proof of journey', 'यात्रा का प्रमाण')}</span>
              <Pill tone={receipt.chain_valid ? 'ok' : 'warn'}>{receipt.chain_valid ? t('Record intact', 'रिकॉर्ड सुरक्षित') : t('Record altered', 'रिकॉर्ड बदला गया')}</Pill>
            </div>
            <span className="sub">{t(`All ${receipt.events.length} steps of this application are sealed in order, each one carrying the fingerprint of the step before it.`, `इस आवेदन के सभी ${receipt.events.length} चरण क्रम में सील किए गए हैं, हर एक अपने पिछले चरण की पहचान लिए हुए।`)}</span>
            <span className="sub">{t('If a step is edited, inserted or removed later, this check stops matching and you can prove it. The record verifies itself, so what happened cannot be changed quietly — by anyone, at any point.', 'यदि बाद में कोई चरण बदला, जोड़ा या हटाया जाता है, तो यह जांच मेल नहीं खाएगी और आप उसे साबित कर सकते हैं। रिकॉर्ड खुद अपनी जांच करता है, इसलिए जो हुआ उसे चुपचाप नहीं बदला जा सकता — कोई भी, कभी भी।')}</span>
            <span className="mono tiny" style={{ overflowWrap: 'anywhere' }}>{receipt.chain_head.slice(0, 32)}…</span>
          </div>
        )}
        <hr className="hr" />
        <DocLinks />
        <Note>{isAadhaar
          ? t('As this is a faceless e-KYC application there is no need to visit the RTO or MLO office. We keep the receipt against your application number, so a lost print costs you nothing.', 'यह फेसलेस e-KYC आवेदन होने के कारण आरटीओ या MLO कार्यालय जाने की ज़रूरत नहीं। हम रसीद को आपके आवेदन नंबर से जोड़कर रखते हैं, इसलिए खोया हुआ प्रिंट आपको कुछ नहीं खर्च करता।', 'हा फेसलेस e-KYC अर्ज असल्याने आरटीओ किंवा MLO कार्यालयात जाण्याची गरज नाही. आम्ही पावती तुमच्या अर्ज क्रमांकाशी जोडून ठेवतो, त्यामुळे हरवलेली प्रिंट तुम्हाला काहीही खर्च करत नाही.')
          : t('Carry a print of this to the office. The official process requires it at the counter — we also keep a copy against your application number.', 'इसकी एक प्रिंट कार्यालय ले जाएं। आधिकारिक प्रक्रिया में काउंटर पर यह आवश्यक है — हम भी आपके आवेदन नंबर से एक प्रति रखते हैं।', 'याची एक प्रिंट कार्यालयात घेऊन जा. अधिकृत प्रक्रियेत काउंटरवर हे आवश्यक आहे — आम्हीही तुमच्या अर्ज क्रमांकाशी एक प्रत ठेवतो.')}</Note>
      </div>
      <div className="sticky-cta"><div className="row g12 wrapf">
        {isAadhaar
          ? <button className="btn btn-p" onClick={() => { update({ stage: 'booked' }); go('tutorial'); }}>{t('Road safety tutorial, then the test', 'सड़क सुरक्षा ट्यूटोरियल, फिर टेस्ट', 'रस्ता सुरक्षा ट्यूटोरियल, नंतर टेस्ट')} {Icon.right()}</button>
          : <button className="btn btn-p" onClick={() => go('slot')}>{t('Book the test slot', 'टेस्ट स्लॉट बुक करें', 'टेस्ट स्लॉट बुक करा')} {Icon.right()}</button>}
        <button className="btn btn-s" onClick={() => go('status')}>{t('See all stages', 'सभी चरण देखें', 'सर्व टप्पे पहा')}</button>
      </div></div>
    </div>
  );
}
