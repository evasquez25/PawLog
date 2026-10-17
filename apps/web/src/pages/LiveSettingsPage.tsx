import { InstallApp } from '@/components/live/InstallApp';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { dataSchemas, profileUpdateSchema, householdUpdateSchema } from '@pawlog/shared';
import { apiRequest, formError } from '@/services/client';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useOnline } from '@/hooks/useOnline';
import { Button } from '@/components/ui/button';
import { PetForm } from '@/components/live/PetForm';
import { AddPetDialog } from '@/components/live/AddPetDialog';
import { ErrorState, LoadState, FormMessage } from '@/components/live/Feedback';
export function LiveSettingsPage() {
  const ctx = useHousehold();
  const { account, household, members, pets, pet, petId, setPet, householdId, isAdmin } = ctx;
  if (account.isPending) return <LoadState />;
  if (account.isError)
    return (
      <div className="page">
        <ErrorState error={account.error} retry={() => void account.refetch()} />
      </div>
    );
  return (
    <div className="page settings-page">
      <p className="eyebrow">YOUR SHARED SPACE</p>
      <h1>A home for your household.</h1>
      <p className="subtext">The humans and little companions behind the care.</p>
      <ProfileForm key={ctx.userId} />
      <InstallApp />
      {!householdId ? (
        <Link className="account-demo-link" to="/app/households">
          Create or join a household →
        </Link>
      ) : (
        <>
          {[household, members, pets]
            .filter((q) => q.isError)
            .map((q, i) => (
              <ErrorState key={i} error={q.error!} retry={() => void ctx.refresh()} />
            ))}
          {household.data && (
            <section className="settings-card">
              <h2>Household</h2>
              {isAdmin ? (
                <HouseholdForm key={`household:${household.data.id}`} />
              ) : (
                <p className="subtext">{household.data.name}</p>
              )}
              <h3 className="members-title">The care crew</h3>
              {members.data?.map((m) => (
                <div className="member-row" key={m.user_id}>
                  <span className="mini-avatar">{m.profile?.display_name[0] ?? '?'}</span>
                  <span>{m.profile?.display_name ?? 'Household member'}</span>
                  <span className="role-badge">
                    {m.role}
                    {m.user_id === ctx.userId ? ' · you' : ''}
                  </span>
                </div>
              ))}
              {isAdmin && <InvitationForm key={`invitation:${householdId}`} />}
              <Link className="account-demo-link" to="/app/households">
                Create or join another household →
              </Link>
            </section>
          )}
          {pets.data && pets.data.length > 0 && (
            <section className="settings-card">
              <label htmlFor="settings-pet">Active pet</label>
              <select id="settings-pet" value={petId} onChange={(e) => setPet(e.target.value)}>
                {pets.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.species}
                  </option>
                ))}
              </select>
              {pet &&
                (isAdmin ? (
                  <PetForm key={pet.id} pet={pet} />
                ) : (
                  <p className="subtext">
                    {pet.name} · {pet.species}
                  </p>
                ))}
            </section>
          )}
          {isAdmin && (
            <AddPetSection key={`new-${householdId}`} />
          )}
        </>
      )}
      <p className="field-hint">Use the sign-out button in the header when you’re done.</p>
      <Link className="account-demo-link" to="/demo">
        Explore the separate sample household →
      </Link>
    </div>
  );
}
function AddPetSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="settings-card">
      <h2>Another little companion?</h2>
      <p className="subtext">
        Add a pet to share their care with your household.
      </p>

      <Button
        type="button"
        variant="outline"
        className="mt-3 min-h-11"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Add pet
      </Button>

      {open && (
        <AddPetDialog onClose={() => setOpen(false)} />
      )}
    </section>
  );
}
function ProfileForm() {
  const { account, refresh } = useHousehold();
  const online = useOnline();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const busy = useRef(false);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: (display_name: string) =>
      apiRequest('/me', dataSchemas.profileUpdate, {
        method: 'PATCH',
        body: profileUpdateSchema.parse({ display_name }),
      }),
  });
  return (
    <form
      className="settings-card"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy.current) return;
        busy.current = true;
        const name = String(new FormData(e.currentTarget).get('name'));
        setError('');
        setSuccess('');
        try {
          await mutation.mutateAsync(name);
          setSuccess('Your name is saved.');
          await refresh();
        } catch (err) {
          setError(formError(err));
        } finally {
          busy.current = false;
        }
      }}
    >
      <h2>Your profile</h2>
      <label htmlFor="profile-name">Display name</label>
      <input
        id="profile-name"
        name="name"
        defaultValue={account.data!.profile.display_name}
        required
        maxLength={60}
        pattern=".*\S.*"
      />
      <Button className="mt-4 min-h-11" disabled={mutation.isPending || !online}>
        {mutation.isPending ? 'Saving…' : 'Save name'}
      </Button>
      <FormMessage error={error} success={success} />
    </form>
  );
}
function HouseholdForm() {
  const { household, householdId, refresh } = useHousehold();
  const online = useOnline();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const busy = useRef(false);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: (input: ReturnType<typeof householdUpdateSchema.parse>) =>
      apiRequest(`/households/${householdId}`, dataSchemas.household, {
        method: 'PATCH',
        body: input,
      }),
  });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy.current) return;
        busy.current = true;
        const values = new FormData(e.currentTarget);
        setError('');
        setSuccess('');
        try {
          const input = householdUpdateSchema.parse({
            name: values.get('name'),
            feeding_warning_minutes: Number(values.get('warning')),
          });
          await mutation.mutateAsync(input);
          setSuccess('Household settings saved.');
          await refresh();
        } catch (err) {
          setError(formError(err));
        } finally {
          busy.current = false;
        }
      }}
    >
      <label htmlFor="live-household-name">Household name</label>
      <input
        id="live-household-name"
        name="name"
        defaultValue={household.data!.name}
        required
        maxLength={80}
        pattern=".*\S.*"
      />
      <label htmlFor="feeding-window">Feeding warning window (minutes)</label>
      <input
        id="feeding-window"
        name="warning"
        type="number"
        min={0}
        max={1440}
        step={1}
        defaultValue={household.data!.feeding_warning_minutes}
        required
      />
      <p className="field-hint">Warn before another recent feeding. Set to 0 to disable.</p>
      <Button className="mt-4 min-h-11" disabled={mutation.isPending || !online}>
        Save household
      </Button>
      <FormMessage error={error} success={success} />
    </form>
  );
}
function InvitationForm() {
  const { householdId } = useHousehold();
  const online = useOnline();
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: () =>
      apiRequest(`/households/${householdId}/invitations`, dataSchemas.invitation, {
        method: 'POST',
        body: {},
      }),
  });
  async function copyCode() {
    setCopied(false);
    setCopyMessage('');

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setCopyMessage('Invitation code copied. Code expires in 48 hours and can be used once.');
    } catch {
      const input = document.getElementById(
        'new-invitation-code',
      ) as HTMLInputElement | null;
      
      input?.focus();
      input?.select();
      input?.setSelectionRange(0, code.length);

      setCopyMessage(
        "Automatic copying was blocked. The code is selected-use your phone's Copy option.",
      );
    }
  }
  return (
    <div className="invitation-panel">
      <h3 className="members-title">Invite a caring human</h3>
      <p className="field-hint">One person can join with each code. It expires in 48 hours.</p>
      <Button
        className="mt-3 min-h-11"
        variant="outline"
        disabled={mutation.isPending || !online}
        onClick={async () => {
          if (busy.current) return;
          busy.current = true;
          setError('');
          setCopyMessage('');
          setCopied(false);
          try {
            const result = await mutation.mutateAsync();
            setCode(result.code);
          } catch (err) {
            setError(formError(err));
          } finally {
            busy.current = false;
          }
        }}
      >
        {mutation.isPending ? 'Creating…' : 'Create invitation code'}
      </Button>
      {code && (
        <>
          <label htmlFor="new-invitation-code">Share this code privately</label>
          <input
            id="new-invitation-code"
            readOnly
            value={code}
            onFocus={(e) => e.target.select()}
          />
          <Button
            type="button"
            variant="outline"
            className={`copy-code-button mt-3 min-h-11 ${copied ? 'is-copied' : ''}`}
            onClick={() => void copyCode()}
          >
            {copied ? 'Copied!' : 'Copy code'}
          </Button>
          <p className="field-hint" role="status">
            {copyMessage}
          </p>
        </>
      )}
      <FormMessage error={error} />
    </div>
  );
}
