import { useState } from 'react';
import { CAPTCHA_QUESTIONS } from '../../data/theoryTest';
import { Icon } from '../../ui/Icon';
import { Input, Note, Pill } from '../../ui/SharedUI';

function speakQuestion(text: string) {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis isn't available in every browser.
  }
}

/** A plain-language abuse-check to replace the official form's distorted-text captcha. */
export function Captcha({ ok, onOk }: { ok: boolean; onOk: (v: boolean) => void }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * CAPTCHA_QUESTIONS.length));
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const question = CAPTCHA_QUESTIONS[index];

  const askDifferent = () => { setIndex((index + 1) % CAPTCHA_QUESTIONS.length); setAnswer(''); setWrong(false); onOk(false); };
  const check = () => {
    const correct = question.a.includes(answer.trim().toLowerCase());
    onOk(correct);
    setWrong(!correct);
  };

  return (
    <div className="card card-p col g14">
      <div className="row between g12 wrapf"><h3>One check that you are a person</h3><Pill>Required</Pill></div>
      <p className="sub">The official form ends on a distorted-text captcha. A public form does need some abuse protection, so this stays — but as a question anyone can answer, that a screen reader can read out, and that you can swap for another. Warped letters exclude people with low vision and stop no real attacker.</p>
      <div className="flat col g12" style={{ padding: '16px 18px' }}>
        <div className="row between g12 wrapf">
          <b style={{ fontWeight: 600, fontSize: '1.02rem' }}>{question.q}</b>
          <div className="row g8">
            <button className="btn btn-s btn-sm" onClick={() => speakQuestion(question.q)} aria-label="Read the question aloud">{Icon.speaker()}</button>
            <button className="btn btn-s btn-sm" onClick={askDifferent}>Different question</button>
          </div>
        </div>
        <div className="row g10 wrapf">
          <Input style={{ maxWidth: 200 }} placeholder="Your answer" value={answer} disabled={ok}
            onChange={e => { setAnswer(e.target.value); setWrong(false); if (ok) onOk(false); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); check(); } }} />
          {ok ? <Pill tone="ok">{Icon.check()} Verified</Pill>
            : <button className="btn btn-s" disabled={!answer.trim()} onClick={check}>Check</button>}
        </div>
        {wrong && <span className="err">That is not right. Try again, or swap it for a different question — no penalty either way.</span>}
      </div>
      <Note>No attempt limit and no lockout. Getting this wrong is never a reason to lose a completed application.</Note>
    </div>
  );
}
