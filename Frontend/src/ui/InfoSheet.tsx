import { INFO_PANELS } from '../data/siteContent';
import { Note, Sheet } from './SharedUI';

/** The footer-linked "learn more" panel — reads a static content block and renders it in a sheet. */
export function InfoSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const panel = INFO_PANELS[id];
  if (!panel) return null;
  return (
    <Sheet title={panel.t} onClose={onClose}>
      <div className="col g20">
        {panel.body.map(([heading, rows, paragraph]) => (
          <div key={heading} className="col g10">
            <h3>{heading}</h3>
            {rows && rows.length > 0 && (
              <div className="flat col g10" style={{ padding: '14px 16px' }}>
                {rows.map(([k, v]) => <div key={k} className="row between g16"><span className="sub">{k}</span><b className="mono" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{v}</b></div>)}
              </div>
            )}
            {paragraph && <p className="sub" style={{ lineHeight: 1.65 }}>{paragraph}</p>}
          </div>
        ))}
        <Note>Prototype. This panel describes the design intent and the limits of what is built.</Note>
      </div>
    </Sheet>
  );
}
