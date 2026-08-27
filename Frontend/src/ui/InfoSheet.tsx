import { INFO_PANELS } from '../data/siteContent';
import { useLanguage, useT } from '../lib/language';
import { Note, Sheet } from './SharedUI';

/** The footer-linked "learn more" panel — reads a static content block and renders it in a sheet. */
export function InfoSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const panel = INFO_PANELS[id];
  if (!panel) return null;
  return (
    <Sheet title={t(panel.t, panel.tHi, panel.tMr)} onClose={onClose}>
      <div className="col g20">
        {panel.body.map(section => {
          // The Hindi rows are a parallel array, not a lookup, so they only line
          // up while both have the same length. Falling back to English wholesale
          // is better than pairing a Hindi label with the wrong amount.
          const rows = lang === 'hi' && section.rowsHi?.length === section.rows?.length
            ? section.rowsHi
            : section.rows;
          return (
            <div key={section.h} className="col g10">
              <h3>{t(section.h, section.hHi, section.hMr)}</h3>
              {rows && rows.length > 0 && (
                <div className="flat col g10" style={{ padding: '14px 16px' }}>
                  {rows.map(([k, v]) => (
                    <div key={k} className="row between g16">
                      <span className="sub">{k}</span>
                      <b className="mono" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{v}</b>
                    </div>
                  ))}
                </div>
              )}
              {section.p && <p className="sub" style={{ lineHeight: 1.65 }}>{t(section.p, section.pHi, section.pMr)}</p>}
            </div>
          );
        })}
        <Note>{t(
          'Prototype. This panel describes the design intent and the limits of what is built.',
          'प्रोटोटाइप। यह पैनल डिज़ाइन का इरादा और जो बनाया गया है उसकी सीमाएँ बताता है।',
          'प्रोटोटाइप. हा पॅनेल डिझाइनचा हेतू आणि जे बांधले आहे त्याच्या मर्यादा सांगतो.',
        )}</Note>
      </div>
    </Sheet>
  );
}
