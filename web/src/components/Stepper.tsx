import { CheckIcon } from '../icons';

// The add-account wizards' progress: done steps get a check, the current one is filled.
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="stepper" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
      {steps.map((label, i) => (
        <li key={label} className={i === current ? 'step-current' : i < current ? 'step-done' : ''}>
          <span className="step-mark">{i < current ? <CheckIcon /> : i + 1}</span>
          <span className="step-label">{label}</span>
        </li>
      ))}
    </ol>
  );
}
