import { useState, useRef, useId } from 'react';
import { useMutation } from '@tanstack/react-query';
import { dataSchemas, petCreateSchema, type Pet } from '@pawlog/shared';
import { useHousehold } from '@/contexts/HouseholdContext';
import { apiRequest, formError } from '@/services/client';
import { useOnline } from '@/hooks/useOnline';
import { Button } from '@/components/ui/button';
import { FormMessage } from './Feedback';
export function PetForm({ pet, onSaved }: { pet?: Pet; onSaved?: () => void }) {
  const speciesId = useId();
  const { householdId, refresh, setPet } = useHousehold();
  const online = useOnline();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const busy = useRef(false);
  const mutation = useMutation({
    networkMode: 'always',
    mutationFn: async (input: ReturnType<typeof petCreateSchema.parse>) =>
      apiRequest(pet ? `/pets/${pet.id}` : `/households/${householdId}/pets`, dataSchemas.pet, {
        method: pet ? 'PATCH' : 'POST',
        body: input,
      }),
  });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy.current) return;
        busy.current = true;
        const form = e.currentTarget;
        setError('');
        setSuccess('');
        try {
          const values = new FormData(form);
          const input = petCreateSchema.parse({
            name: values.get('name'),
            species: values.get('species'),
            photo_url: String(values.get('photo_url') ?? '').trim() || null,
          });
          const saved = await mutation.mutateAsync(input);
          setPet(saved.id);
          await refresh();
          setSuccess(`${saved.name}’s profile is saved.`);
          if (!pet) form.reset();
          onSaved?.();
        } catch (err) {
          setError(formError(err));
        } finally {
          busy.current = false;
        }
      }}
    >
      <h2>{pet ? 'Pet profile' : 'Meet your little sidekick'}</h2>
      <label htmlFor={pet ? 'pet-name' : 'new-pet-name'}>Pet name</label>
      <input
        id={pet ? 'pet-name' : 'new-pet-name'}
        name="name"
        defaultValue={pet?.name}
        required
        maxLength={60}
        pattern=".*\S.*"
      />
      <label htmlFor={pet ? 'pet-species' : 'new-pet-species'}>Species</label>
      <input
        id={pet ? 'pet-species' : 'new-pet-species'}
        name="species"
        defaultValue={pet?.species ?? 'Dog'}
        required
        maxLength={40}
        pattern=".*\S.*"
        list={speciesId}
      />
      <datalist id={speciesId}>
        <option>Dog</option>
        <option>Cat</option>
        <option>Rabbit</option>
        <option>Bird</option>
        <option>Other</option>
      </datalist>
      <label htmlFor={pet ? 'pet-photo' : 'new-pet-photo'}>
        Photo URL <span className="optional">(optional)</span>
      </label>
      <input
        id={pet ? 'pet-photo' : 'new-pet-photo'}
        name="photo_url"
        type="url"
        defaultValue={pet?.photo_url ?? ''}
        maxLength={2048}
        placeholder="https://…"
      />
      <p className="field-hint">Use an HTTPS image link, or leave blank for an illustration.</p>
      <Button className="save-button mt-5" disabled={mutation.isPending || !online}>
        {mutation.isPending ? 'Saving…' : pet ? 'Save pet' : 'Add pet'}
      </Button>
      <FormMessage error={error} success={success} />
    </form>
  );
}
