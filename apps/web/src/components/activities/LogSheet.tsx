import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { X, Clock3, AlertTriangle, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDemo } from '@/contexts/DemoContext';
import { logInputSchema, latestLog, members, type activities } from '@/lib/demo';
type Activity = (typeof activities)[number];
export function LogSheet({
  activity,
  petName,
  onClose,
  onSaved,
}: {
  activity: Activity;
  petName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { logs, addLog, petId } = useDemo();
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const [member, setMember] = useState('Eric');
  const [time, setTime] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const el = dialog.current!;
    const focus = document.activeElement as HTMLElement | null;
    el.showModal();
    el.querySelector<HTMLSelectElement>('#member')?.focus();
    document.body.style.overflow = 'hidden';
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      el.close();
      document.body.style.overflow = '';
      focus?.focus();
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  function save(override = false) {
    if (submitting.current) return;
    if (!navigator.onLine) {
      setError('You’re offline. Reconnect before trying this action.');
      return;
    }
    const parsed = logInputSchema.safeParse({ member, time, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the fields.');
      return;
    }
    const latest = latestLog(logs, petId, activity.id);
    if (
      activity.id === 'feeding' &&
      latest &&
      Date.now() - Date.parse(latest.time) < 15 * 60000 &&
      !override
    ) {
      setWarning(true);
      return;
    }
    submitting.current = true;
    setSaving(true);
    addLog({
      id: requestId.current,
      petId,
      type: activity.id,
      member: parsed.data.member,
      time: new Date(parsed.data.time).toISOString(),
      note: parsed.data.note,
    });
    onSaved();
  }
  return (
    <dialog
      ref={dialog}
      className="log-dialog"
      aria-labelledby="sheet-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet-handle" />
      <div className="sheet-heading">
        <span className={`activity-icon ${activity.tone}`}>
          <Clock3 size={23} />
        </span>
        <button className="icon-button" aria-label="Close logging sheet" onClick={onClose}>
          <X />
        </button>
      </div>
      <h2 id="sheet-title">Log {activity.name.toLowerCase()}</h2>
      <p className="subtext">A little care for {petName}. A little peace of mind.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label htmlFor="member">Who completed this?</label>
        <select
          autoFocus
          id="member"
          value={member}
          onChange={(event) => setMember(event.target.value)}
        >
          {members.map((person) => (
            <option key={person} value={person}>
              {person}
              {person === 'Eric' ? ' (you · sample user)' : ''}
            </option>
          ))}
        </select>
        <label htmlFor="when">When?</label>
        <input
          id="when"
          type="datetime-local"
          required
          max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
          value={time}
          onChange={(event) => {
            setTime(event.target.value);
            setError('');
          }}
        />
        <p className="field-hint">Defaults to now. You can record an earlier time.</p>
        <label htmlFor="note">
          Note <span className="optional">(optional)</span>
        </label>
        <textarea
          id="note"
          placeholder="Anything the household should know?"
          maxLength={280}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <span className="character-count">{note.length}/280</span>
        {offline && (
          <p className="form-error" role="alert">
            You’re offline. Reconnect to continue.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {warning && (
          <div className="warning" role="alert">
            <AlertTriangle size={20} />
            <div>
              <strong>{petName} was fed recently.</strong>
              <p>
                Another feeding was recorded within 15 minutes by{' '}
                {latestLog(logs, petId, 'feeding')?.member}. Log another?
              </p>
              <Button type="button" variant="outline" onClick={() => save(true)}>
                Log Anyway
              </Button>
            </div>
          </div>
        )}
        <p className="demo-disclosure">Prototype only: this updates sample data in this tab.</p>
        <Button className="save-button" disabled={saving || offline} type="submit">
          {saving && <LoaderCircle className="animate-spin" size={18} />}Save Activity
        </Button>
        <button type="button" className="cancel-button" onClick={onClose}>
          Cancel
        </button>
      </form>
    </dialog>
  );
}
