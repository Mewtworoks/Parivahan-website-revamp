import React from 'react';

/**
 * The last thing between a render error and a white screen.
 *
 * React unmounts the whole tree when a render throws and nothing catches it,
 * which on a static host means the page simply goes blank — no message, no
 * back button, nothing to press. That is unrecoverable for anyone who is not
 * going to think of reloading, and it is the worst thing that can happen to
 * somebody halfway through an application.
 *
 * The journey itself survives: it is in localStorage and on the server, not in
 * the component tree. So the honest thing to say is that the screen broke and
 * the application did not, and to offer the reload rather than wait for it to
 * be guessed.
 *
 * Deliberately not styled as an error page. A citizen who reaches this has
 * already had one bad surprise; a red full-bleed screen is a second one.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Kept for whoever opens the console. There is no error-reporting service
    // in this build, and inventing one to swallow this would be worse than
    // printing it where a developer will actually look.
    console.error('A screen failed to render.', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="narrow fade" style={{ padding: '64px 24px' }}>
        <div className="card card-p col g14">
          <h1 style={{ margin: 0 }}>This screen stopped working.</h1>
          <p className="lede" style={{ margin: 0 }}>
            Nothing you filled in has been lost. Your application, and any appointment
            you have booked, are held by the licence service rather than by this page —
            reloading comes back to exactly where you were.
          </p>
          <p className="sub" style={{ margin: 0 }}>
            यह स्क्रीन काम करना बंद कर गई। आपने जो भरा है वह सुरक्षित है — आपका आवेदन और
            अपॉइंटमेंट इस पेज पर नहीं, लाइसेंस सेवा के पास हैं। पेज रीलोड करने पर आप वहीं
            वापस आ जाएंगे जहां थे।
          </p>
          <div className="row g12 wrapf">
            <button className="btn btn-p" onClick={() => window.location.reload()}>
              Reload this page · पेज रीलोड करें
            </button>
            <button
              className="btn btn-s"
              onClick={() => {
                window.location.hash = '#/home';
                window.location.reload();
              }}
            >
              Start again from home · होम से शुरू करें
            </button>
          </div>
        </div>
      </div>
    );
  }
}
