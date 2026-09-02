import { useEffect, useRef, useState } from 'react';
import * as api from '../api';
import { useLanguage, useT } from '../lib/language';
import { scrollToTop } from '../lib/scrollToTop';
import { useAction } from '../lib/useApi';
import type { PageProps } from '../types';
import { Icon } from '../ui/Icon';
import { Note, Progress } from '../ui/SharedUI';

/**
 * The learner's theory test, served by the licence service.
 *
 * Ten questions, six correct to pass — the real shell. The questions come from
 * the service's own bank, which refuses to repeat a question inside one
 * attempt, and the correct answer is never sent to the browser: it arrives only
 * after the answer is submitted, with the rule it comes from. Answering is
 * scored on the server, so a pass is something the service recorded, not
 * something this page decided.
 */
export function Test({ go, state, update }: PageProps) {
  const t = useT();
  const { lang } = useLanguage();
  const isAadhaar = state.form?.route === 'aadhaar';

  const [attemptId, setAttemptId] = useState<string | null>(state.attemptId || null);
  const [passMark, setPassMark] = useState(6);
  const [question, setQuestion] = useState<api.NextQuestion | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<api.AnswerResult | null>(null);
  const [result, setResult] = useState<api.TestResultView | null>(null);
  const { pending, error, run } = useAction();
  const askedAt = useRef<number>(Date.now());
  const started = useRef(false);

  // Begin an attempt on first arrival, then pull the first question.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      let id = attemptId;
      if (!id) {
        const begun = await run('start', () => api.startTest(state.app?.no || state.form?.phone || 'citizen'));
        if (!begun) return;
        id = begun.attempt_id;
        setPassMark(begun.pass_threshold);
        setAttemptId(id);
        update({ attemptId: id });
      }
      const first = await run('next', () => api.nextQuestion(id!));
      if (first) { setQuestion(first); askedAt.current = Date.now(); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const check = async () => {
    if (!pick || !question?.scenario || !attemptId) return;
    const res = await run('answer', () => api.submitAnswer(
      attemptId, question.scenario!.id, pick, (Date.now() - askedAt.current) / 1000,
    ));
    if (res) setFeedback(res);
  };

  const advance = async () => {
    if (!attemptId) return;
    if (feedback && feedback.answered >= feedback.total) {
      const final = await run('result', () => api.testResult(attemptId));
      if (final) {
        setResult(final);
        update({
          stage: final.status === 'passed' ? 'issued' : state.stage,
          score: final.score,
          scoreTotal: final.total,
        });
        if (final.status === 'passed') { go('issued'); return; }
      }
      return;
    }
    const next = await run('next', () => api.nextQuestion(attemptId));
    if (next) {
      setQuestion(next);
      setPick(null);
      setFeedback(null);
      askedAt.current = Date.now();
      scrollToTop();
    }
  };

  if (error) {
    return (
      <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
        {/* Named with a heading, like every other screen. Deep-linked here with
            the service down, the page was a lone warning box with nothing
            saying which screen it was. */}
        <div className="col g16">
          <h1>{t("Learner's theory test", 'लर्नर थ्योरी टेस्ट')}</h1>
          <Note tone="warn">{t('The test cannot start.', 'टेस्ट शुरू नहीं हो सका।')}{' '}
            {api.isOffline(error)
              ? t('The licence service is not responding. Your application is unaffected — the test can be taken when it is back.', 'लाइसेंस सेवा जवाब नहीं दे रही। आपके आवेदन पर कोई असर नहीं — सेवा वापस आने पर टेस्ट दिया जा सकता है।')
              : error.message}</Note>
          <div className="row g10 wrapf">
            <button className="btn btn-s" onClick={() => go('status')}>{t('Back to my application', 'मेरे आवेदन पर वापस')}</button>
            <button className="btn btn-g" onClick={() => go('learn')}>{t('Practise while you wait', 'इंतज़ार के दौरान अभ्यास करें')}</button>
          </div>
        </div>
      </div>
    );
  }

  // Failed attempt — the service recorded it, so say so and what it costs.
  if (result && result.status !== 'passed') {
    const weak = Object.entries(result.by_competency).filter(([, v]) => v.wrong > 0);
    return (
      <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
        <div className="card card-p col g16">
          <h1>{t('Not passed this time.', 'इस बार पास नहीं हुए।')}</h1>
          <p className="lede">{t(`You answered ${result.score} of ${result.total} correctly. ${result.pass_threshold} are needed.`, `आपने ${result.total} में से ${result.score} सही दिए। ${result.pass_threshold} चाहिए।`)}</p>
          {weak.length > 0 && (
            <div className="col g8">
              <span className="label">{t('Worth practising before you retake it', 'दोबारा देने से पहले अभ्यास लायक')}</span>
              {weak.map(([key, v]) => (
                <div key={key} className="row between g12"><span className="sub">{key.replace(/_/g, ' ')}</span><span className="tiny">{v.correct}/{v.correct + v.wrong}</span></div>
              ))}
            </div>
          )}
          <Note>{t('A retake costs the ₹50 test fee and a fresh booking. The practice game covers exactly these judgments, and it is free.', 'दोबारा देने पर ₹50 टेस्ट फीस और नई बुकिंग लगती है। अभ्यास गेम इन्हीं बातों को कवर करता है, और वह मुफ़्त है।')}</Note>
          <div className="row g12 wrapf">
            <button className="btn btn-p" onClick={() => go('learn')}>{t('Practise first', 'पहले अभ्यास करें')} {Icon.right()}</button>
            <button className="btn btn-s" onClick={() => go('status')}>{t('Back to my application', 'मेरे आवेदन पर वापस')}</button>
          </div>
        </div>
        <div style={{ height: 56 }} />
      </div>
    );
  }

  const scenario = question?.scenario;
  if (!scenario) {
    return (
      <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
        <div className="col g16">
          <h1>{t("Learner's theory test", 'लर्नर थ्योरी टेस्ट')}</h1>
          <Note>{t('Preparing your test…', 'आपका टेस्ट तैयार हो रहा है…')}</Note>
        </div>
      </div>
    );
  }

  const total = question!.total ?? 10;
  const prompt = (lang === 'hi' && scenario.prompt_hi) ? scenario.prompt_hi : scenario.prompt;
  const isLast = feedback ? feedback.answered >= feedback.total : question!.index + 1 >= total;

  return (
    <div className="narrow fade" style={{ padding: '40px 24px 0' }}>
      <div className="col g16" style={{ marginBottom: 22 }}>
        <Progress cur={question!.index} total={total} label={t("Learner's test · stage 8 of 8", 'लर्नर टेस्ट · चरण 8 में से 8', 'लर्नर टेस्ट · टप्पा 8 पैकी 8')} />
        <Note>{isAadhaar ? t(`${total} questions, ${passMark} correct to pass, taken from home with a password sent by SMS.`, `${total} सवाल, पास होने के लिए ${passMark} सही, SMS से भेजे पासवर्ड के साथ घर से।`) : t(`${total} questions, ${passMark} correct to pass, taken at the office.`, `${total} सवाल, पास होने के लिए ${passMark} सही, कार्यालय में।`)} {t('A fail costs the ₹50 test fee again and a rebooking, so every answer here explains itself.', 'फेल होने पर फिर से ₹50 टेस्ट फीस और नई बुकिंग लगती है, इसलिए यहां हर जवाब खुद समझाया गया है।', 'नापास झाल्यास पुन्हा ₹50 टेस्ट फी आणि नवीन बुकिंग लागते, त्यामुळे इथे प्रत्येक उत्तर स्वतः स्पष्ट केले आहे.')}</Note>
      </div>
      <div className="card card-p col g20">
        <h2 style={{ fontSize: '1.3rem' }}>{prompt}</h2>
        <div className="col g10" role="radiogroup">
          {scenario.options.map(opt => {
            const isCorrect = feedback?.correct_option_id === opt.id;
            const chosen = pick === opt.id;
            const style = feedback && isCorrect ? { borderColor: 'var(--ok)', background: 'var(--ok-soft)' } : feedback && chosen && !isCorrect ? { borderColor: 'var(--bad)', background: 'var(--bad-soft)' } : undefined;
            return (
              <button key={opt.id} className="tile" role="radio" aria-checked={chosen} style={style} disabled={Boolean(feedback)} onClick={() => setPick(opt.id)}>
                <span className="tick">{chosen ? Icon.check() : null}</span>
                <span style={{ fontWeight: 500 }}>{(lang === 'hi' && opt.label_hi) ? opt.label_hi : opt.label}</span>
              </button>
            );
          })}
        </div>
        {feedback && (
          <div className="fade col g14">
            <Note tone={feedback.correct ? 'ok' : 'warn'} icon={feedback.correct ? Icon.check() : undefined}>
              {feedback.correct ? t('Correct.', 'सही।', 'बरोबर.') : t('Not quite.', 'बिल्कुल नहीं।', 'अगदी बरोबर नाही.')} {feedback.explanation}
              {feedback.mv_act_ref && <><br /><span className="tiny mono">{feedback.mv_act_ref}</span></>}
            </Note>
            <div className="row between g12 wrapf">
              <span className="tiny">{t(`${feedback.score_so_far} correct out of ${feedback.answered} answered`, `${feedback.answered} में से ${feedback.score_so_far} सही`)}</span>
              <button className="btn btn-p" disabled={pending !== null} onClick={() => void advance()}>{isLast ? t('Finish and see the result', 'समाप्त करें और परिणाम देखें', 'पूर्ण करा आणि निकाल पहा') : t('Next question', 'अगला सवाल', 'पुढील प्रश्न')} {Icon.right()}</button>
            </div>
          </div>
        )}
        {!feedback && <button className="btn btn-p" disabled={pick === null || pending !== null} onClick={() => void check()}>{t('Check answer', 'जवाब जांचें', 'उत्तर तपासा')}</button>}
      </div>
      <div style={{ height: 56 }} />
    </div>
  );
}
