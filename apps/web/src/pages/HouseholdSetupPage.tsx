import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { dataSchemas, householdCreateSchema, invitationRedeemSchema } from '@pawlog/shared';
import { apiRequest, formError } from '@/services/client';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useOnline } from '@/hooks/useOnline';
import { Button } from '@/components/ui/button';
import { FormMessage } from '@/components/live/Feedback';
export function HouseholdSetupPage() {
  const { setHousehold, refresh } = useHousehold();
  const navigate = useNavigate();
  const online = useOnline();
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: async ({ mode, value }: { mode: 'create' | 'join'; value: string }) => {
      if (mode === 'create') {
        const input = householdCreateSchema.parse({ name: value });
        return (
          await apiRequest('/households', dataSchemas.created, { method: 'POST', body: input })
        ).id;
      }
      const input = invitationRedeemSchema.parse({ code: value });
      return (
        await apiRequest('/invitations/redeem', dataSchemas.joined, { method: 'POST', body: input })
      ).household_id;
    },
  });
  async function submit(form: HTMLFormElement, mode: 'create' | 'join') {
    if (busy.current) return;
    busy.current = true;
    setError('');
    try {
      const value = String(new FormData(form).get(mode === 'create' ? 'name' : 'code') ?? '');
      const id = await mutation.mutateAsync({ mode, value });
      setHousehold(id);
      await refresh();
      navigate('/app', { replace: true });
    } catch (err) {
      setError(formError(err));
    } finally {
      busy.current = false;
    }
  }
  return (
    <div className="page setup-page">
      <p className="eyebrow">CARE IS BETTER TOGETHER</p>
      <h1>A happy home starts here.</h1>
      <p className="subtext">
        Create your household, or join the people already caring for your pet.
      </p>
      <div className="setup-grid">
        <form
          className="settings-card"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget, 'create');
          }}
        >
          <h2>Create a household</h2>
          <label htmlFor="new-household">Household name</label>
          <input
            id="new-household"
            name="name"
            required
            maxLength={80}
            pattern=".*\S.*"
            placeholder="The Vasquez household"
          />
          <p className="field-hint">
            You’ll become its administrator. Invite your family afterward.
          </p>
          <Button className="save-button mt-5" disabled={mutation.isPending || !online}>
            Create household
          </Button>
        </form>
        <form
          className="settings-card"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget, 'join');
          }}
        >
          <h2>Join your household</h2>
          <label htmlFor="invite-code">Invitation code</label>
          <input
            id="invite-code"
            name="code"
            required
            minLength={43}
            maxLength={128}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="field-hint">
            Ask a household admin for a code. Codes expire after 48 hours and work once.
          </p>
          <Button
            className="save-button mt-5"
            variant="outline"
            disabled={mutation.isPending || !online}
          >
            Join household
          </Button>
        </form>
      </div>
      <FormMessage error={error} />
    </div>
  );
}
