import { useState } from 'react';
import { DOCS } from '../data/documents';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Pill } from '../ui/SharedUI';

/** Before-you-start checklist: what six things the application needs, and what to do if you don't have one. */
export function Checklist({ go }: PageProps) {
  const [have, setHave] = useState<Record<string, 'yes' | 'no'>>({});
  const missingCount = DOCS.filter(d => have[d.id] === 'no').length;

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <button className="btn btn-g btn-sm" style={{ marginLeft: -12, marginBottom: 14 }} onClick={() => go('elig')}>{Icon.left()} Back</button>
      <div className="col g10" style={{ marginBottom: 26 }}>
        <span className="eyebrow">Before you start</span>
        <h1>Six things, and three of them we fetch</h1>
        <p className="lede">Tell us what you have. If something is missing you will see the accepted substitute now, instead of at the RTO counter.</p>
      </div>
      <div className="col g12">
        {DOCS.map(doc => (
          <div key={doc.id} className="flat" style={{ padding: '16px 18px' }}>
            <div className="row between g16 wrapf">
              <div className="col g4 grow" style={{ minWidth: 220 }}>
                <div className="row g10 wrapf"><b style={{ fontWeight: 600 }}>{doc.name}</b>{doc.auto && <Pill tone="brand">Auto</Pill>}</div>
                <span className="sub">{doc.need}</span>
              </div>
              <div className="seg" role="group" aria-label={doc.name}>
                <button aria-pressed={have[doc.id] === 'yes'} onClick={() => setHave({ ...have, [doc.id]: 'yes' })}>I have it</button>
                <button aria-pressed={have[doc.id] === 'no'} onClick={() => setHave({ ...have, [doc.id]: 'no' })}>I don't</button>
              </div>
            </div>
            {have[doc.id] === 'no' && (
              <div style={{ marginTop: 12 }}>
                <Note tone="warn">{doc.id === 'photo' || doc.id === 'sign'
                  ? 'You can take this on the phone during the application. A plain wall and daylight is enough.'
                  : doc.id === 'form1' ? 'Form 1 is a declaration you tick yourself for a bike or car. Nothing to arrange.'
                  : 'If it is not in DigiLocker you can upload a photo of the original. A passport, PAN card, ration card, electricity bill or rent agreement is accepted in place of Aadhaar.'}</Note>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="sticky-cta">
        <div className="col g12">
          {missingCount > 0 && <span className="sub">{missingCount} item{missingCount > 1 ? 's' : ''} marked missing. You can still start — the application saves as you go.</span>}
          <button className="btn btn-p" style={{ maxWidth: 340 }} onClick={() => go('apply')}>Start the application {Icon.right()}</button>
        </div>
      </div>
    </div>
  );
}
