import { usePlacementEditorStore } from './usePlacementEditorStore';
import './proposition.css';

export function PropositionBrief() {
  const proposition = usePlacementEditorStore((state) => state.document.proposition);
  if (!proposition) return null;

  return (
    <section className="proposition-brief" data-testid="design-proposition-brief" style={{ '--proposition-accent': proposition.accent } as React.CSSProperties}>
      <div className="proposition-identity">
        <span className="proposition-index">Design proposition</span>
        <h1>{proposition.title}</h1>
        <p>{proposition.thesis}</p>
      </div>
      <div className="proposition-promise">
        <span>Stakeholder promise</span>
        <strong>{proposition.experientialPromise}</strong>
        <small>{proposition.signatureMove}</small>
      </div>
      <div className="proposition-hierarchy">
        <span>Visual hierarchy</span>
        <ol>
          {proposition.hierarchy.map((item) => <li key={item}>{item}</li>)}
        </ol>
      </div>
      <div className="proposition-decisions">
        <div>
          <span>Keep</span>
          <ul>{proposition.adoptedQualities.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <span>Reject</span>
          <ul>{proposition.rejectedQualities.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
      <div className="proposition-tradeoffs">
        <span>Known tradeoffs</span>
        {proposition.tradeoffs.map((item) => <p key={item}>{item}</p>)}
      </div>
    </section>
  );
}
