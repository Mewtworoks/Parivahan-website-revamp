import * as api from '../api';
import { useT } from '../lib/language';
import { useApi } from '../lib/useApi';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';

/**
 * What the service has learned from the people it failed.
 *
 * Every other screen here is about one citizen's journey. This one is about all
 * of them at once, and it is the only screen with no name on it anywhere — that
 * is the point of it. The rows behind these counts carry an HMAC of a citizen
 * reference and an allowlisted handful of fields; there is no name, no number,
 * no date of birth and no transcript in the table, so there is nothing here to
 * protect and the endpoint needs no key.
 *
 * Two questions, both real:
 *
 *   Which competency do the most people get wrong?  A curriculum reads that.
 *   Which form field do they stall at?              A service designer reads that.
 *
 * Neither needs to know who any of them were, which is the argument this page
 * exists to make: a public service can measure its own failures without
 * building a file on the citizens who hit them.
 */

/** The competencies, in the citizen's language. The API returns the enum name. */
const COMPETENCY: Record<string, [string, string]> = {
  right_of_way: ['Right of way', 'रास्ते का अधिकार'],
  pedestrian_safety: ['Pedestrian safety', 'पैदल यात्री सुरक्षा'],
  roundabout: ['Roundabouts', 'गोल चक्कर'],
  overtaking: ['Overtaking', 'ओवरटेकिंग'],
  emergency_vehicle: ['Emergency vehicles', 'आपातकालीन वाहन'],
  lane_discipline: ['Lane discipline', 'लेन अनुशासन'],
  sign_recognition: ['Reading signs', 'संकेत पहचान'],
  hazard_anticipation: ['Spotting hazards', 'खतरा भाँपना'],
  night_weather: ['Night and weather', 'रात और मौसम'],
};

/** The form fields, likewise. These are the names the agent asks under. */
const FIELD: Record<string, [string, string]> = {
  full_name: ['Full name', 'पूरा नाम'],
  dob: ['Date of birth', 'जन्म तिथि'],
  state: ['State', 'राज्य'],
  licence_classes: ['Vehicle class', 'वाहन श्रेणी'],
  phone: ['Mobile number', 'मोबाइल नंबर'],
};

/** What each kind of failure is, said in one line rather than left as a slug. */
const KIND: Record<string, [string, string]> = {
  'test.wrong': ['Practice answer wrong', 'अभ्यास उत्तर गलत'],
  'form.unparsed': ['Answer could not be read', 'उत्तर पढ़ा नहीं जा सका'],
  'form.reasked': ['Same question asked twice', 'वही सवाल दोबारा पूछा गया'],
  'form.abandoned': ['Form left unfinished', 'फ़ॉर्म अधूरा छोड़ा गया'],
  'form.offtrack': ['Reply discarded by the guard', 'गार्ड ने जवाब हटाया'],
  'slot.lost': ['Slot lost to someone else', 'स्लॉट किसी और को गया'],
  'tool.error': ['A tool failed', 'एक टूल विफल'],
  'model.failed': ['Language service unreachable', 'भाषा सेवा अनुपलब्ध'],
};

/**
 * One row of the ranking.
 *
 * A bar rather than a number alone: "right of way, 14" says nothing without the
 * next line to compare it against, and the whole use of this page is the shape
 * of the distribution rather than any single figure in it.
 */
function Bar({ label, count, of }: { label: string; count: number; of: number }) {
  return (
    <div className="col g4">
      <div className="row between g12">
        <span className="sub" style={{ color: 'var(--ink)' }}>{label}</span>
        <b className="mono" style={{ fontWeight: 600 }}>{count}</b>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 999, background: 'var(--brand)',
          width: `${of ? Math.max(4, (count / of) * 100) : 0}%`,
        }} />
      </div>
    </div>
  );
}

function Ranking({ title, note, rows, name }: {
  title: string; note: string;
  rows: { name: string; count: number }[];
  name: (key: string) => string;
}) {
  const t = useT();
  const top = rows[0]?.count ?? 0;
  return (
    <div className="card card-p col g16">
      <div className="col g4">
        <h3>{title}</h3>
        <span className="sub">{note}</span>
      </div>
      {rows.length === 0
        ? <span className="tiny">{t('Nothing recorded yet. Take the practice test or talk to Saarthi, and this fills in.',
          'अभी कुछ दर्ज नहीं है। अभ्यास टेस्ट दीजिए या सारथी से बात कीजिए, यह भर जाएगा।')}</span>
        : <div className="col g14">
          {rows.map(r => <Bar key={r.name} label={name(r.name)} count={r.count} of={top} />)}
        </div>}
    </div>
  );
}

export function Learning({ go }: PageProps) {
  const t = useT();
  const { data, error, loading } = useApi(signal => api.signalsSummary(signal), []);

  const named = (table: Record<string, [string, string]>) => (key: string) => {
    const pair = table[key];
    return pair ? t(pair[0], pair[1]) : key;
  };

  return (
    <div className="narrow fade" style={{ padding: '48px 24px 64px' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }}
        onClick={() => go('home')}>{Icon.left()} {t('Home', 'होम', 'होम')}</button>

      <div className="col g14" style={{ alignItems: 'flex-start', marginBottom: 26 }}>
        <Pill tone="brand">{Icon.dot()} {t('What the service learns', 'सेवा क्या सीखती है')}</Pill>
        <h1>{t('Where people actually fail', 'लोग असल में कहाँ अटकते हैं')}</h1>
        <p className="lede">
          {t('Every screen on this site is about one person’s journey. This one is about all of them, and it is the only screen with no name on it anywhere — that is the point of it. A public service can measure its own failures without building a file on the citizens who hit them.',
            'इस साइट का हर पन्ना एक व्यक्ति की यात्रा के बारे में है। यह पन्ना सबके बारे में है, और यही इकलौता पन्ना है जिस पर कहीं कोई नाम नहीं — यही इसका मक़सद है। कोई सार्वजनिक सेवा अपनी विफलताएँ नाप सकती है, बिना उन नागरिकों की फ़ाइल बनाए जिन्हें वे झेलनी पड़ीं।')}
        </p>
      </div>

      {loading && <Note>{t('Reading the failure log…', 'विफलता लॉग पढ़ा जा रहा है…')}</Note>}
      {error && (
        <Note tone="warn">
          {api.isOffline(error)
            ? t('The licence service is not responding, so there is nothing to read.',
              'लाइसेंस सेवा जवाब नहीं दे रही, इसलिए पढ़ने को कुछ नहीं है।')
            : error.message}
        </Note>
      )}

      {data && (
        <div className="col g20">
          <div className="card card-p row between g16 wrapf">
            <div className="col g4">
              <b style={{ fontSize: '1.9rem', fontFamily: 'var(--disp)' }}>{data.total}</b>
              <span className="tiny">{t('failures recorded, none of them attributable',
                'दर्ज विफलताएँ, कोई भी किसी व्यक्ति से जुड़ी नहीं')}</span>
            </div>
            <div className="col g6" style={{ alignItems: 'flex-end' }}>
              <Pill tone="ok">{Icon.check()} {t('No names, numbers or dates of birth',
                'न नाम, न नंबर, न जन्म तिथि')}</Pill>
              <span className="tiny">{t('Reference is an HMAC; detail is allowlisted per kind.',
                'संदर्भ एक HMAC है; विवरण हर प्रकार के लिए अनुमत सूची से।')}</span>
            </div>
          </div>

          <Ranking
            title={t('Hardest to get right', 'सबसे मुश्किल')}
            note={t('Which road-safety competency the most people answer wrongly. A syllabus reads this and knows what to teach harder.',
              'सड़क सुरक्षा की कौन-सी दक्षता सबसे ज़्यादा लोग गलत करते हैं। पाठ्यक्रम इसे पढ़कर जान सकता है कि किस पर ज़ोर देना है।')}
            rows={data.hardest_competencies}
            name={named(COMPETENCY)}
          />

          <Ranking
            /* Not "where the form loses people". Every field that can appear
               here is one Saarthi asks for — the web wizard records nothing at
               all — so the old title named a source this ranking cannot draw
               from. An unsupported claim is worth less than a narrower true
               one, and least of all on this page. */
            title={t('Where Saarthi loses people', 'सारथी लोगों को कहाँ खोता है')}
            note={t('The field they stall at, abandon at, or get asked for twice. A service designer reads this and knows which question is badly written.',
              'वह फ़ील्ड जहाँ वे अटकते हैं, छोड़ देते हैं, या जो दोबारा पूछी जाती है। सेवा डिज़ाइनर इसे पढ़कर जान सकता है कि कौन-सा सवाल ठीक से नहीं लिखा गया।')}
            rows={data.stalling_fields}
            name={named(FIELD)}
          />

          {data.by_kind.length > 0 && (
            <div className="card card-p col g14">
              <h3>{t('Everything recorded', 'सब कुछ जो दर्ज है')}</h3>
              <div className="col g10">
                {data.by_kind.map(k => (
                  <div key={k.kind} className="row between g16 wrapf">
                    <span className="sub" style={{ color: 'var(--ink)' }}>{named(KIND)(k.kind)}</span>
                    <span className="row g10">
                      <span className="tiny mono">{k.kind}</span>
                      <b className="mono" style={{ fontWeight: 600 }}>{k.count}</b>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stated rather than left to be worked out. A prototype's traffic is
              a handful of walkthroughs, and a bar chart drawn over eleven rows
              looks exactly like one drawn over eleven million. Naming the limit
              is the difference between a demonstration and a claim. */}
          <Note>
            {t('This is prototype traffic.', 'यह प्रोटोटाइप का डेटा है।')}{' '}
            {t('These counts come from whoever has walked through this build — tens of attempts, not a national dataset. What is being shown is that the measurement is possible and safe, not what the answer turns out to be.',
              'ये गिनतियाँ उन लोगों से आई हैं जिन्होंने यह बिल्ड आज़माया — कुछ दर्जन प्रयास, कोई राष्ट्रीय आँकड़ा नहीं। यहाँ यह दिखाया जा रहा है कि यह माप संभव और सुरक्षित है, न कि यह कि जवाब क्या निकलता है।')}
          </Note>
        </div>
      )}
      <div style={{ height: 40 }} />
    </div>
  );
}
