import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { CloseIcon } from '../icons';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Under the title, above the scrolling body (e.g. a stepper).
  head?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  wide?: boolean;
  // Pass one to close the drawer from inside (after a save); otherwise it keeps its own.
  dialogRef?: RefObject<HTMLDialogElement>;
}

// Side panel on a native modal <dialog>: focus trap, Escape and the backdrop come from the browser.
// Opens when mounted; closing it (X, Escape, dialogRef.current.close()) calls onClose to unmount it.
export function Drawer({ title, onClose, children, head, footer, closeLabel = 'Close', wide, dialogRef }: Props) {
  const ownRef = useRef<HTMLDialogElement>(null);
  const ref = dialogRef ?? ownRef;
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [ref]);

  return (
    <dialog ref={ref} className={`drawer ${wide ? 'drawer-wide' : ''}`} onClose={onClose} aria-labelledby={titleId}>
      <header className="drawer-head">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => ref.current?.close()}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <CloseIcon />
        </button>
      </header>
      {head}
      <div className="drawer-body">{children}</div>
      {footer ? <footer className="drawer-foot">{footer}</footer> : null}
    </dialog>
  );
}
