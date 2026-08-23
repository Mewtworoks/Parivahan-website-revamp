import { Icon } from './Icon';

const DOCUMENT_LABELS = ['Application reference slip', 'Application form, pre-filled', 'Self declaration (Form 1)', 'Print acknowledgement'];

export function DocLinks() {
  return (
    <div className="col g10">
      <span className="tiny" style={{ fontWeight: 600 }}>Your documents, all in one place</span>
      <div className="row g10 wrapf">
        {DOCUMENT_LABELS.map(label => <button key={label} className="btn btn-s btn-sm">{Icon.doc()} {label}</button>)}
      </div>
      <span className="tiny">The official portal scatters these as blue links in the corner of the status page. They are the same four files.</span>
    </div>
  );
}
