import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, Clock3, AlertTriangle, LoaderCircle } from 'lucide-react';
import {
  activityCreateSchema,
  activityLogSchema,
  dataSchemas,
  type ActivityType,
  type ActivityCreateInput,
  type LatestActivity,
} from '@pawlog/shared';
import { Button } from '@/components/ui/button';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useOnline } from '@/hooks/useOnline';
import { apiRequest, ApiRequestError } from '@/services/client';
export function LiveLogSheet({
  activity,
  onClose,
  onSaved,
}: {
  activity: ActivityType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { userId, members, pet, petId } = useHousehold();
  const cache = useQueryClient();
  const online = useOnline();
  const dialog = useRef<HTMLDialogElement>(null);
  const key = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const [member, setMember] = useState(userId);
  const [time, setTime] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState<{ name: string; time: string; minutes: number } | null>(
    null,
  );
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<ActivityCreateInput | null>(null);
  const mutation = useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: (body: ActivityCreateInput) =>
      apiRequest(`/pets/${petId}/activities`, dataSchemas.savedActivity, {
        method: 'POST',
        body,
        idempotencyKey: key.current,
      }),
  });
  useEffect(() => {
    const el = dialog.current!;
    const focus = document.activeElement as HTMLElement | null;
    el.showModal();
    el.querySelector<HTMLSelectElement>('select')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      el.close();
      document.body.style.overflow = '';
      focus?.focus();
    };
  }, []);
  function close() {
    if (submitting.current) return;
    onClose();
  }
  async function save(override = false) {
    if (submitting.current) return;
    setError('');
    let body: ActivityCreateInput;
    try {
      body =
        uncertain && attempt.current
          ? attempt.current
          : activityCreateSchema.parse({
              activity_type_id: activity.id,
              performed_by: member,
              performed_at: new Date(time).toISOString(),
              notes: note,
              allow_recent: override,
            });
    } catch {
      setError('Check the member, note, and completion time. The time must not be in the future.');
      return;
    }
    submitting.current = true;
    attempt.current = body;
    try {
      const result = await mutation.mutateAsync(body);
      const name =
        members.data?.find((m) => m.user_id === result.log.performed_by)?.profile?.display_name ??
        'Household member';
      cache.setQueryData<LatestActivity[]>(['latest', userId, petId], (old) =>
        old?.map((row) =>
          row.activity_type.id !== activity.id
            ? row
            : row.latest &&
                Date.parse(row.latest.performed_at) >= Date.parse(result.log.performed_at)
              ? row
              : { ...row, latest: { ...result.log, performed_by_name: name } },
        ),
      );
      void cache.invalidateQueries({ queryKey: ['latest', userId, petId] });
      onSaved();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'RECENT_FEEDING') {
        const details = err.details as { latest?: unknown; warning_minutes?: number };
        const latest = activityLogSchema.safeParse(details?.latest);
        if (latest.success) {
          setWarning({
            name:
              members.data?.find((m) => m.user_id === latest.data.performed_by)?.profile
                ?.display_name ?? 'a household member',
            time: latest.data.performed_at,
            minutes: details.warning_minutes ?? 15,
          });
          setUncertain(false);
        } else setError(err.message);
      } else {
        setError((err as Error).message);
        setUncertain(
          err instanceof ApiRequestError &&
            (['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(err.code) || err.status >= 500),
        );
      }
    } finally {
      submitting.current = false;
    }
  }
  const pending = mutation.isPending;
  return (
    <dialog
      ref={dialog}
      className="log-dialog"
      aria-labelledby="live-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet-handle" />
      <div className="sheet-heading">
        <span className="activity-icon sage">
          <Clock3 size={23} />
        </span>
        <button
          className="icon-button"
          aria-label="Close logging sheet"
          disabled={pending}
          onClick={close}
        >
          <X />
        </button>
      </div>
      <h2 id="live-sheet-title">Log {activity.name.toLowerCase()}</h2>
      <p className="subtext">A little care for {pet?.name}. A little peace of mind.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={pending || uncertain} className="plain-fieldset">
          <label htmlFor="live-member">Who completed this?</label>
          <select
            id="live-member"
            value={member}
            onChange={(e) => {
              setMember(e.target.value);
              setWarning(null);
            }}
          >
            {members.data?.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profile?.display_name ?? 'Household member'}
                {m.user_id === userId ? ' (you)' : ''}
              </option>
            ))}
          </select>
          <label htmlFor="live-when">When?</label>
          <input
            id="live-when"
            type="datetime-local"
            required
            max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
            value={time}
            onChange={(e) => {
              setTime(e.target.value);
              setWarning(null);
            }}
          />
          <p className="field-hint">Defaults to now. You can choose an earlier time.</p>
          <label htmlFor="live-note">
            Note <span className="optional">(optional)</span>
          </label>
          <textarea
            id="live-note"
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the household should know?"
          />
          <span className="character-count">{note.length}/280</span>
        </fieldset>
        {!online && (
          <p className="form-error" role="alert">
            You’re offline. Reconnect to save.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {uncertain && (
          <p className="field-hint">
            This activity may already be saved. Retry without changing the fields to confirm; avoid
            starting a second submission.
          </p>
        )}
        {warning && (
          <div className="warning" role="alert">
            <AlertTriangle size={20} />
            <div>
              <strong>{pet?.name} was fed recently.</strong>
              <p>
                {warning.name} recorded a feeding at{' '}
                {format(new Date(warning.time), 'MMM d, h:mm a')}, within the {warning.minutes}
                -minute warning window.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={pending || !online}
                onClick={() => void save(true)}
              >
                Log Anyway
              </Button>
            </div>
          </div>
        )}
        <Button
          className="save-button mt-5"
          disabled={pending || !online || (!uncertain && !!warning)}
          type="submit"
        >
          {pending && <LoaderCircle size={18} className="animate-spin" />}
          {pending ? 'Saving…' : uncertain ? 'Retry to confirm' : 'Save Activity'}
        </Button>
        <button type="button" className="cancel-button" disabled={pending} onClick={close}>
          Cancel
        </button>
      </form>
    </dialog>
  );
}
