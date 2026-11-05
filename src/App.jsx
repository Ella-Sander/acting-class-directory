const disciplines = ['Acting', 'On camera', 'Scene study', 'Improv', 'Audition craft', 'Voice & movement'];

export default function App() {
  return (
    <main className="foundation-page">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Acting Class Directory home">
          <span className="wordmark-mark" aria-hidden="true">AC</span>
          <span>ACTING CLASS<br />DIRECTORY</span>
        </a>
        <div className="header-note"><span className="status-dot" /> NEW YORK CITY · EDITION 01</div>
      </header>

      <section className="direction-preview" aria-labelledby="preview-title">
        <p className="eyebrow">A new guide to the work</p>
        <h1 id="preview-title">Find the room<br />where you <em>grow.</em></h1>
        <p className="intro">A considered directory of acting studios, classes and coaches across New York City. Built to help you find the right training, at the right price, for the work ahead.</p>
        <div className="preview-rule"><span>THE DIRECTORY IS IN DEVELOPMENT</span><span>NEW YORK, NY</span></div>
      </section>

      <section className="discipline-band" aria-label="Training areas">
        <p className="eyebrow">Explore the craft</p>
        <ul>{disciplines.map(item => <li key={item}>{item}<span aria-hidden="true">↗</span></li>)}</ul>
      </section>

      <footer className="site-footer"><span>ACTING CLASS DIRECTORY</span><span>Independent. Actor-first. New York.</span></footer>
    </main>
  );
}
