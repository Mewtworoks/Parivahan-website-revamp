import React, { useEffect, useRef, useState } from 'react';

import * as api from '../api';
import { Badge, Button, Callout, JsonPeek, Mono, Panel } from './ui';
import styles from './AgentConsole.module.scss';

/**
 * The citizen-side voice copilot, without the microphone.
 *
 * The voice layer is an OpenAI Realtime session in the client; what makes it
 * useful is that it is wired to these function tools, which hit the same
 * endpoints and the same state as the rest of this app. So it cannot tell the
 * citizen something the portal disagrees with — it is reading and writing the
 * one journey. This console replays a real conversation against the live
 * backend so you can watch the tool calls land.
 */

// What the citizen says, and the tool the model would emit for it.
const WALKTHROUGH = [
  {
    say: null,
    said: 'agent checks who it is talking to',
    tool: 'get_journey_status',
    args: (ctx) => ({ citizen_id: ctx.citizenId }),
  },
  {
    say: 'मुझे लर्नर लाइसेंस बनवाना है',
    said: '"I want to get a learner licence"',
    tool: 'apply_for_licence',
    args: (ctx) => ({ citizen_ref: ctx.citizenId, licence_kind: 'learner' }),
    keep: (res, ctx) => ({ ...ctx, applicationId: res.application_id }),
  },
  {
    say: null,
    said: 'the model retries its own call (dropped socket)',
    tool: 'apply_for_licence',
    args: (ctx) => ({ citizen_ref: ctx.citizenId, licence_kind: 'learner' }),
    note: (res, ctx) =>
      res.application_id === ctx.applicationId
        ? 'Same application came back — the agent cannot create duplicates by retrying.'
        : 'A second application was created — that would be a bug.',
  },
  {
    say: 'कब का समय मिल सकता है?',
    said: '"What appointment times are available?"',
    tool: 'find_slots',
    args: () => ({}),
    keep: (res, ctx) => ({ ...ctx, slot: res.slots?.[0] }),
  },
  {
    say: 'पहला वाला बुक कर दो',
    said: '"Book the first one"',
    tool: 'book_slot',
    args: (ctx) => ({ application_id: ctx.applicationId, slot_id: ctx.slot?.slot_id }),
  },
  {
    say: 'मैं पहुँच गया हूँ',
    said: '"I have arrived"',
    tool: 'check_in',
    args: (ctx) => ({ application_id: ctx.applicationId }),
    keep: (res, ctx) => ({ ...ctx, tokenId: res.token_id }),
  },
  {
    say: 'मेरा नंबर कब आएगा?',
    said: '"When is my turn?"',
    tool: 'check_queue',
    args: (ctx) => ({ token_id: ctx.tokenId }),
  },
  {
    say: 'पास होने के लिए कितने सही चाहिए?',
    said: '"How many do I need right to pass?"',
    tool: 'explain_ll_step',
    args: () => ({ step: 'pass_criteria', language: 'hi' }),
  },
  {
    say: null,
    said: 'agent re-reads the journey it just moved',
    tool: 'get_journey_status',
    args: (ctx) => ({ citizen_id: ctx.citizenId }),
  },
];

export default function AgentConsole() {
  const [tools, setTools] = useState([]);
  const [transcript, setTranscript] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const [selected, setSelected] = useState('list_competencies');
  const [argText, setArgText] = useState('{}');
  const [manualResult, setManualResult] = useState(null);

  const tailRef = useRef(null);

  useEffect(() => {
    api.agentTools()
      .then((res) => setTools(res.tools))
      .catch(setError);
  }, []);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript.length]);

  const runWalkthrough = async () => {
    setRunning(true);
    setError(null);
    setTranscript([]);
    // A fresh citizen each run, so the journey starts from nothing every time.
    let ctx = { citizenId: `cit_voice_${Date.now().toString(36)}` };

    try {
      for (const turn of WALKTHROUGH) {
        const args = turn.args(ctx);
        setTranscript((t) => [...t, { kind: 'call', ...turn, args }]);
        // eslint-disable-next-line no-await-in-loop
        const res = await api.agentDispatch(turn.tool, args);
        const note = turn.note ? turn.note(res, ctx) : null;
        if (turn.keep) ctx = turn.keep(res, ctx);
        setTranscript((t) => [...t, { kind: 'result', tool: turn.tool, res, note }]);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 320));
      }
    } catch (err) {
      setError(err);
    } finally {
      setRunning(false);
    }
  };

  const dispatchManual = async () => {
    setError(null);
    setManualResult(null);
    let parsed;
    try {
      parsed = JSON.parse(argText || '{}');
    } catch {
      setError(new Error('Arguments must be valid JSON'));
      return;
    }
    try {
      setManualResult(await api.agentDispatch(selected, parsed));
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className={styles.wrap}>
      <Panel
        title="The voice copilot's hands"
        subtitle="A copilot that only talks is a chatbot. These are the function tools the Realtime model is given, each one wired to the same endpoints and the same state as the rest of this app."
        action={<Badge tone="brand">{tools.length} tools</Badge>}
      >
        <div className={styles.toolGrid}>
          {tools.map((t) => (
            <div key={t.name} className={styles.tool}>
              <Mono>{t.name}</Mono>
              <p className={styles.toolDesc}>{t.description}</p>
              <div className={styles.toolArgs}>
                {Object.keys(t.parameters?.properties || {}).length === 0 ? (
                  <span className={styles.noArgs}>no arguments</span>
                ) : (
                  Object.keys(t.parameters.properties).map((p) => (
                    <span key={p} className={styles.arg}>
                      {p}
                      {t.parameters.required?.includes(p) && <em>*</em>}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
        <JsonPeek label="GET /agent/tools — the schema registered on the Realtime session" data={{ tools }} />
      </Panel>

      <Panel
        title="Replay a conversation against the live backend"
        subtitle="Spoken Hindi in, real state changes out — an application created, a slot held, a token issued. Every line below is an actual request and its actual response."
        action={
          <Button onClick={runWalkthrough} loading={running}>
            {transcript.length ? 'Run it again' : 'Run the Hindi walkthrough'}
          </Button>
        }
      >
        {error && (
          <Callout tone="danger" title={`${error.status || ''} error`.trim()}>
            {error.detail || error.message}
          </Callout>
        )}

        {transcript.length === 0 && !running && (
          <Callout tone="info">
            Press the button. Nine turns, nine real tool calls — then open the Journey tab and
            look up the citizen it created.
          </Callout>
        )}

        <div className={styles.transcript}>
          {transcript.map((line, i) =>
            line.kind === 'call' ? (
              <div key={i} className={styles.turn}>
                {line.say && (
                  <div className={styles.citizen}>
                    <span className={styles.speaker}>citizen</span>
                    <div>
                      <p className={styles.hindi}>{line.say}</p>
                      <p className={styles.gloss}>{line.said}</p>
                    </div>
                  </div>
                )}
                {!line.say && <p className={styles.systemLine}>{line.said}</p>}
                <div className={styles.call}>
                  <span className={styles.callLabel}>tool call</span>
                  <Mono>{line.tool}</Mono>
                  <code className={styles.callArgs}>{JSON.stringify(line.args)}</code>
                </div>
              </div>
            ) : (
              <div key={i} className={styles.result}>
                <pre className={styles.resultBody}>{JSON.stringify(line.res, null, 2)}</pre>
                {line.note && <p className={styles.resultNote}>{line.note}</p>}
              </div>
            ),
          )}
          <div ref={tailRef} />
        </div>
      </Panel>

      <Panel
        title="Or call a tool yourself"
        subtitle="Exactly what the model does when it emits a function call: POST /agent/dispatch with a tool name and arguments."
      >
        <div className={styles.manualRow}>
          <select
            className={styles.select}
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setManualResult(null);
            }}
          >
            {tools.map((t) => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
          <input
            className={styles.argInput}
            value={argText}
            onChange={(e) => setArgText(e.target.value)}
            placeholder='{"citizen_id": "cit_demo"}'
            spellCheck={false}
          />
          <Button variant="secondary" onClick={dispatchManual}>Dispatch</Button>
        </div>
        {manualResult && <JsonPeek label="response" data={manualResult} open />}
      </Panel>
    </div>
  );
}
