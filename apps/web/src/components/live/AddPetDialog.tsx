import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PetForm } from '@/components/live/PetForm';

export function AddPetDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;

    element.showModal();
    element.querySelector<HTMLInputElement>('input')?.focus();
    document.body.style.overflow = 'hidden';

    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  function close() {
    if (!busy.current) onClose();
  }

  return (
    <dialog
      ref={dialog}
      className="log-dialog"
      aria-label="Add a pet"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <PetForm
        onBusyChange={(value) => {
          busy.current = value;
          setSaving(value);
        }}
        onSaved={onClose}
      />

      <Button
        type="button"
        variant="outline"
        className="mt-3 min-h-11 w-full"
        disabled={saving}
        onClick={close}
      >
        Cancel
      </Button>
    </dialog>
  );
}