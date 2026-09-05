import { NEXT_STAGE_ROUTE, nextStage, stageState } from '../data/applicationFlow';
import { useT } from '../lib/language';
import type { AppState, Route, StageRow } from '../types';
import { Icon } from './Icon';
import { Pill } from './SharedUI';

const STATUS_LABEL: Record<StageRow['status'], [hi: string, mr: string]> = {
  Completed: ['पूर्ण', 'पूर्ण'],
  Exempted: ['छूट प्राप्त', 'सूट मिळालेले'],
  'To be done by you': ['आपको करना है', 'तुम्हाला करायचे आहे'],
};

/** Shows every post-submission stage with its status, and a shortcut to whichever one is next. */
export function StageTable({ state, go }: { state: AppState; go: (route: Route) => void }) {
  const t = useT();
  const rows = stageState(state);
  const isAadhaar = state.form?.route === 'aadhaar';
  const next = nextStage(state);
  const target = (next && NEXT_STAGE_ROUTE[next.k]) || 'status';
  return (
    <div className="card col" style={{ overflow: 'hidden' }}>
      <div className="col g6" style={{ padding: '20px 22px' }}>
        <div className="row between g12 wrapf">
          <h3>{t('Stages to be completed', 'पूर्ण होने वाले चरण', 'पूर्ण करायचे टप्पे')}</h3>
          <Pill tone={isAadhaar ? 'ok' : 'warn'}>{isAadhaar ? t('Faceless — no RTO visit', 'फेसलेस — कोई आरटीओ यात्रा नहीं', 'फेसलेस — आरटीओ भेट नाही') : t('In-person verification', 'व्यक्तिगत सत्यापन', 'प्रत्यक्ष पडताळणी')}</Pill>
        </div>
        <span className="sub">{t('Seven stages. The official portal shows this table and leaves you to work out which one is yours to do.', 'सात चरण। आधिकारिक पोर्टल यह तालिका दिखाता है और आपको खुद समझना पड़ता है कि कौन सा चरण आपका है।', 'सात टप्पे. अधिकृत पोर्टल हे सारणी दाखवते आणि कोणता टप्पा तुमचा आहे हे तुम्हालाच शोधावे लागते.')}</span>
      </div>
      <hr className="hr" />
      <div className="col">
        {rows.map((row, i) => {
          const [statusHi, statusMr] = STATUS_LABEL[row.status];
          return (
            <div key={row.k} className="stagerow" data-now={row === next ? '1' : null}>
              <span className="rail-n" style={{ flex: 'none', ...(row.status === 'Completed' ? { background: 'var(--ok)', borderColor: 'var(--ok)', color: '#fff' } : row.status === 'Exempted' ? { background: 'var(--brand-soft)', borderColor: 'var(--brand-line)', color: 'var(--brand)' } : {}) }}>
                {row.status === 'Completed' ? Icon.check() : i + 1}</span>
              <span className="col g4 grow" style={{ minWidth: 0 }}>
                <b style={{ fontWeight: 600, fontSize: '.95rem' }}>{t(row.n, row.nHi, row.nMr)}</b>
                {row.status === 'Exempted' && <span className="tiny">{t('Not needed because you authenticated with Aadhaar', 'आधार से सत्यापन करने के कारण आवश्यक नहीं', 'आधारने पडताळणी केल्यामुळे आवश्यक नाही')}</span>}
                {row === next && row.k === 'test' && <span className="tiny">{t('Password comes by SMS to your registered mobile', 'पासवर्ड आपके पंजीकृत मोबाइल पर एसएमएस द्वारा आता है', 'पासवर्ड तुमच्या नोंदणीकृत मोबाइलवर एसएमएसने येतो')}</span>}
              </span>
              <Pill tone={row.status === 'Completed' ? 'ok' : row.status === 'Exempted' ? 'brand' : 'warn'}>{t(row.status, statusHi, statusMr)}</Pill>
            </div>
          );
        })}
      </div>
      {next && (
        <>
          <hr className="hr" />
          <div style={{ padding: '18px 22px' }} className="row between g12 wrapf">
            <span className="sub">{t('Next:', 'आगे:', 'पुढे:')} <b style={{ fontWeight: 600, color: 'var(--ink)' }}>{t(next.n, next.nHi, next.nMr)}</b></span>
            <button className="btn btn-p btn-sm" onClick={() => go(target)}>{t('Continue', 'जारी रखें', 'सुरू ठेवा')} {Icon.right()}</button>
          </div>
        </>
      )}
    </div>
  );
}
