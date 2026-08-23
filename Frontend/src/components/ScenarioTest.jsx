import React, { useCallback, useState } from 'react';

import * as api from '../api';
import {
  Badge, Button, Callout, Field, JsonPeek, Mono, Panel, Stat,
} from './ui';
import ScenarioStage from './ScenarioStage';
import styles from './ScenarioTest.module.scss';

const COMPETENCY_LABEL = {
  right_of_way: 'Right of way',
  pedestrian_safety: 'Pedestrian safety',
  roundabout: 'Roundabouts',
  overtaking: 'Overtaking',
  emergency_vehicle: 'Emergency vehicles',
  lane_discipline: 'Lane discipline',
  sign_recognition: 'Sign recognition',
  hazard_anticipation: 'Hazard anticipation',
  night_weather: 'Night & weather',
};

export default function ScenarioTest() {
  const [citizenId, setCitizenId] = useState('cit_demo');
  const [lang, setLang] = useState('en');

  const [attempt, setAttempt] = useState(null);
  const [question, setQuestion] = useState(null);
  const [askedAt, setAskedAt] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);

  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const guard = useCallback(async (name, fn) => {
    setBusy(name);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setBusy(null);
    }
  }, []);

  const loadNext = (attemptId) =>
    guard('next', async () => {
      const q = await api.nextQuestion(attemptId);
      setFeedback(null);
      setChosen(null);
      if (q.done) {
        setQuestion(null);
        setResult(await api.testResult(attemptId));
      } else {
        setQuestion(q);
        setAskedAt(Date.now());
      }
      return q;
    });

  const start = () =>
    guard('start', async () => {
      const started = await api.startTest(citizenId);
      setAttempt(started);
      setResult(null);
      await loadNext(started.attempt_id);
      return started;
    });

  const answer = (optionId) =>
    guard(`answer:${optionId}`, async () => {
      setChosen(optionId);
      const res = await api.submitAnswer(attempt.attempt_id, {
        scenarioId: question.scenario.id,
        optionId,
        timeTakenS: askedAt ? (Date.now() - askedAt) / 1000 : 0,
      });
      setFeedback(res);
      if (res.answered >= res.total) setResult(await api.testResult(attempt.attempt_id));
      return res;
    });

  const flagProctor = () =>
    guard('proctor', async () => {
      const res = await api.reportProctorFlag(attempt.attempt_id, 'identity_mismatch');
      setResult(await api.testResult(attempt.attempt_id));
      return res;
    });

  const reset = () => {
    setAttempt(null);
    setQuestion(null);
    setFeedback(null);
    setChosen(null);
    setResult(null);
    setError(null);
  };

  const scenario = question?.scenario;
  const promptText = scenario && (lang === 'hi' ? scenario.prompt_hi || scenario.prompt : scenario.prompt);
  const finished = Boolean(result) && !question;

  return (
    <div className={styles.wrap}>
      {error && (
        <Callout tone="danger" title={`${error.status || ''} error`.trim()}>
          {error.detail || error.message}
        </Callout>
      )}

      {!attempt && (
        <Panel
          title="The theory test, reimagined"
          subtitle="Same legal shell — 15 questions, 9 correct to pass, proctored. What changes is that a question is a moving situation you have to read, not a sentence you memorised."
        >
          <div className={styles.startRow}>
            <Field label="Citizen reference">
              <input value={citizenId} onChange={(e) => setCitizenId(e.target.value)} />
            </Field>
            <Field label="Language">
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </Field>
          </div>
          <div>
            <Button onClick={start} loading={busy === 'start'}>Start the test</Button>
          </div>
          <Callout tone="info" title="What the backend guarantees here">
            All 15 scenarios are distinct — the bank refuses to serve a repeat in a statutory
            test. The correct answer is never in the payload the browser receives; open the raw
            response below any question and check.
          </Callout>
        </Panel>
      )}

      {attempt && scenario && (
        <Panel
          title={`Question ${question.index + 1} of ${question.total}`}
          subtitle={COMPETENCY_LABEL[scenario.competency] || scenario.competency}
          action={
            <div className={styles.headActions}>
              <Badge tone="neutral">difficulty {scenario.difficulty}</Badge>
              <button
                className={styles.langToggle}
                onClick={() => setLang((l) => (l === 'en' ? 'hi' : 'en'))}
              >
                {lang === 'en' ? 'हिन्दी' : 'English'}
              </button>
            </div>
          }
        >
          <div className={styles.progressDots}>
            {Array.from({ length: question.total }).map((_, i) => (
              <span
                key={i}
                className={`${styles.dot} ${
                  i < question.index ? styles.dotDone : i === question.index ? styles.dotNow : ''
                }`}
              />
            ))}
          </div>

          <ScenarioStage scenario={scenario} paused={Boolean(feedback)} />

          <p className={styles.prompt}>{promptText}</p>

          <div className={styles.options}>
            {scenario.options.map((opt) => {
              const isChosen = chosen === opt.id;
              const isTruth = feedback && feedback.correct_option_id === opt.id;
              const state = !feedback
                ? ''
                : isTruth
                ? styles.optionRight
                : isChosen
                ? styles.optionWrong
                : styles.optionMuted;
              return (
                <button
                  key={opt.id}
                  className={`${styles.option} ${state}`}
                  onClick={() => answer(opt.id)}
                  disabled={Boolean(feedback) || busy?.startsWith('answer')}
                >
                  <span className={styles.optionKey}>{opt.id}</span>
                  <span className={styles.optionLabel}>
                    {lang === 'hi' ? opt.label_hi || opt.label : opt.label}
                  </span>
                  {feedback && isTruth && <span className={styles.optionMark}>✓</span>}
                  {feedback && isChosen && !isTruth && <span className={styles.optionMark}>✕</span>}
                </button>
              );
            })}
          </div>

          {feedback && (
            <>
              <Callout
                tone={feedback.correct ? 'success' : 'danger'}
                title={feedback.correct ? 'Correct' : 'Not the safest action'}
              >
                {feedback.explanation}
                {feedback.mv_act_ref && (
                  <div className={styles.lawRef}>
                    Legal basis: <Mono>{feedback.mv_act_ref}</Mono>
                  </div>
                )}
              </Callout>
              <div className={styles.footRow}>
                <span className={styles.score}>
                  Score {feedback.score_so_far} / {feedback.answered} answered
                </span>
                {feedback.answered < feedback.total ? (
                  <Button onClick={() => loadNext(attempt.attempt_id)} loading={busy === 'next'}>
                    Next scenario
                  </Button>
                ) : (
                  <Button onClick={() => loadNext(attempt.attempt_id)} loading={busy === 'next'}>
                    See my result
                  </Button>
                )}
              </div>
            </>
          )}

          <div className={styles.proctorRow}>
            <span className={styles.proctorNote}>
              Proctoring is still enforced — the subsystem posts events to the same attempt.
            </span>
            <Button variant="ghost" onClick={flagProctor} loading={busy === 'proctor'}>
              Simulate an identity mismatch
            </Button>
          </div>

          <JsonPeek label="GET /test/{id}/next — what the browser actually receives" data={question} />
        </Panel>
      )}

      {finished && (
        <Panel
          title="Result"
          subtitle="A number and a certificate is where the current test stops. This tells you which judgment to go and practise."
          action={
            <Badge
              tone={
                result.status === 'passed' ? 'success' : result.status === 'voided' ? 'warning' : 'danger'
              }
            >
              {result.status}
            </Badge>
          }
        >
          <div className={styles.stats}>
            <Stat
              label="Score"
              value={`${result.score} / ${result.total}`}
              tone={result.status === 'passed' ? 'success' : 'danger'}
              hint={`pass mark is ${result.pass_threshold}`}
            />
            <Stat label="Status" value={result.status} />
            <Stat
              label="Proctor flags"
              value={result.proctor_flags.length}
              tone={result.proctor_flags.length ? 'danger' : 'success'}
              hint={result.proctor_flags.join(', ') || 'clean attempt'}
            />
          </div>

          {result.status === 'voided' && (
            <Callout tone="warning" title="Attempt voided">
              A disqualifying proctor flag ends the attempt immediately — the same guarantee the
              current online LL test makes, kept intact.
            </Callout>
          )}

          <div className={styles.breakdown}>
            {Object.entries(result.by_competency).map(([key, v]) => {
              const total = v.correct + v.wrong;
              const pct = total ? (v.correct / total) * 100 : 0;
              return (
                <div key={key} className={styles.compRow}>
                  <span className={styles.compName}>{COMPETENCY_LABEL[key] || key}</span>
                  <div className={styles.compBar}>
                    <div
                      className={styles.compFill}
                      style={{
                        width: `${pct}%`,
                        background: pct === 100 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className={styles.compScore}>
                    {v.correct}/{total}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.footRow}>
            <Button variant="secondary" onClick={reset}>Take it again</Button>
          </div>

          <JsonPeek label="GET /test/{id}/result — raw response" data={result} />
        </Panel>
      )}
    </div>
  );
}
