import { useMemo, useState } from 'react';
import { DimensionCanvas } from './DimensionCanvas';
import { weightOfRememberingDimension } from './weightOfRemembering';
import './dimension.css';

export function DimensionApp() {
  const dimension = useMemo(() => weightOfRememberingDimension, []);
  const [paused, setPaused] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedZone, setSelectedZone] = useState(dimension.zones[2]?.id ?? dimension.zones[0]?.id ?? '');
  const zone = dimension.zones.find((candidate) => candidate.id === selectedZone);

  return (
    <main
      className="dimension-shell"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        dimension.setPointer(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
        );
      }}
      onPointerLeave={() => dimension.setPointer(0, 0)}
    >
      <DimensionCanvas dimension={dimension} paused={paused} />
      <div className="dimension-film" aria-hidden="true" />

      <header className="dimension-header">
        <div>
          <span className="dimension-kicker">Confluence · Dimension 01</span>
          <h1>{dimension.title}</h1>
          <p>{dimension.subtitle}</p>
        </div>
        <div className="dimension-actions">
          <button type="button" className={paused ? 'active' : ''} onClick={() => setPaused((value) => !value)}>{paused ? 'Resume life' : 'Pause life'}</button>
          <button type="button" className={showMap ? 'active' : ''} onClick={() => setShowMap((value) => !value)}>{showMap ? 'Hide dimension map' : 'Open dimension map'}</button>
        </div>
      </header>

      <aside className="dimension-law">
        <span>Dimensional law</span>
        <blockquote>{dimension.law}</blockquote>
      </aside>

      <nav className="dimension-zones" aria-label="Dimension zones">
        {dimension.zones.map((candidate, index) => (
          <button
            type="button"
            key={candidate.id}
            className={candidate.id === selectedZone ? 'active' : ''}
            onClick={() => setSelectedZone(candidate.id)}
          >
            <small>{String(index + 1).padStart(2, '0')}</small>
            <span>{candidate.label}</span>
          </button>
        ))}
      </nav>

      {zone && (
        <section className="dimension-zone-card">
          <span>Current region</span>
          <h2>{zone.label}</h2>
          <p>{zone.role}</p>
          <div><b>{dimension.nodes.filter((node) => Math.hypot(node.x - zone.center[0], node.y - zone.center[1]) <= zone.radius).length}</b> active elements within this field</div>
        </section>
      )}

      <footer className="dimension-status">
        <span><b>{dimension.nodes.length}</b> living nodes</span>
        <span><b>{dimension.layers.length}</b> depth layers</span>
        <span><b>{dimension.paths.length}</b> current paths</span>
        <span><b>{dimension.zones.length}</b> world regions</span>
      </footer>

      {showMap && (
        <section className="dimension-map" data-testid="dimension-map">
          <header><span>World construction map</span><strong>As far as the eye can carry remembrance</strong></header>
          <div className="dimension-map-field">
            {dimension.paths.map((path) => (
              <svg key={path.id} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={path.label}>
                <polyline points={path.points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')} style={{ stroke: path.color }} />
              </svg>
            ))}
            {dimension.zones.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                style={{ left: `${candidate.center[0] * 100}%`, top: `${candidate.center[1] * 100}%` }}
                className={candidate.id === selectedZone ? 'active' : ''}
                onClick={() => setSelectedZone(candidate.id)}
                title={candidate.role}
              >{candidate.label}</button>
            ))}
          </div>
          <ol>{dimension.layers.map((layer) => <li key={layer.id}><b>{layer.label}</b><span>Depth {layer.depth.toFixed(2)} · parallax {layer.parallax.toFixed(3)}</span></li>)}</ol>
        </section>
      )}
    </main>
  );
}
