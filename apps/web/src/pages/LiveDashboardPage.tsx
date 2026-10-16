import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import {
  Bone,
  Trees,
  Footprints,
  Droplets,
  Plus,
  Check,
  Heart,
  PawPrint,
  ChevronDown,
} from 'lucide-react';
import { dataSchemas, type ActivityType } from '@pawlog/shared';
import { apiRequest } from '@/services/client';
import { useHousehold } from '@/contexts/HouseholdContext';
import { LoadState, ErrorState } from '@/components/live/Feedback';
import { PetPortrait } from '@/components/pets/PetPortrait';
import { PetForm } from '@/components/live/PetForm';
import { LiveLogSheet } from '@/components/live/LiveLogSheet';
import { HouseholdSetupPage } from './HouseholdSetupPage';
const icons: Record<string, typeof Bone> = {
  bone: Bone,
  trees: Trees,
  footprints: Footprints,
  droplets: Droplets,
};
export function LiveDashboardPage() {
  const ctx = useHousehold();
  const { account, household, householdId, members, pets, pet, petId, isAdmin } = ctx;
  if (account.isPending) return <LoadState />;
  if (account.isError)
    return (
      <div className="page">
        <ErrorState error={account.error} retry={() => void account.refetch()} />
      </div>
    );
  if (!householdId) return <HouseholdSetupPage />;
  const failed = [household, members, pets].find((q) => q.isError);
  if (failed?.error)
    return (
      <div className="page">
        <ErrorState error={failed.error} retry={() => void ctx.refresh()} />
      </div>
    );
  if (household.isPending || members.isPending || pets.isPending) return <LoadState />;
  if (!pet)
    return (
      <div className="page setup-page">
        <p className="eyebrow">ONE MORE LITTLE STEP</p>
        <h1>Let’s meet your pet.</h1>
        <p className="subtext">
          {isAdmin
            ? 'Add your first companion to start sharing care.'
            : 'Ask a household administrator to add your pet.'}
        </p>
        {isAdmin && (
          <section className="settings-card">
            <PetForm />
          </section>
        )}
        <Link className="account-demo-link" to="/app/settings">
          Household settings →
        </Link>
      </div>
    );
  return <PetDashboard key={`${householdId}:${petId}`} />;
}
function PetDashboard() {
  const { userId, account, pet, petId, pets, setPet, members } = useHousehold();
  const [activity, setActivity] = useState<ActivityType | null>(null);
  const [toast, setToast] = useState('');
  const [, tick] = useState(0);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const latest = useQuery({
    queryKey: ['latest', userId, petId],
    queryFn: ({ signal }) =>
      apiRequest(`/pets/${petId}/latest-activities`, dataSchemas.latest, { signal }),
    retry: false,
  });
  useEffect(() => {
    const id = window.setInterval(() => tick((v) => v + 1), 30000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="page dashboard">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1>
            {greeting}, {account.data!.profile.display_name}
            <span className="greeting-dot">.</span>
          </h1>
          <p className="subtext">A happy pet starts with a little teamwork.</p>
        </div>
        <div className="care-badge">
          <Heart size={17} />
          Better, together
        </div>
      </div>
      <section className="pet-hero" aria-labelledby="pet-title">
        <div className="hero-copy">
          <span className="pet-label">
            <span />
            YOUR LITTLE SIDEKICK
          </span>
          <h2 id="pet-title">
            How’s {pet!.name}
            <br />
            doing today?
          </h2>
          <p>All their care. All in one happy place.</p>
          <div className="pet-select-wrap">
            <PawPrint size={16} />
            <select
              aria-label="Selected pet"
              value={petId}
              onChange={(e) => setPet(e.target.value)}
            >
              {pets.data!.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.species}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
        <div className="portrait-wrap">
          {pet!.photo_url && pet!.photo_url !== failedPhoto ? (
            <img
              className="pet-photo"
              src={pet!.photo_url}
              alt={pet!.name}
              referrerPolicy="no-referrer"
              onError={() => setFailedPhoto(pet!.photo_url)}
            />
          ) : (
            <PetPortrait cat={pet!.species.toLowerCase() === 'cat'} petName={pet!.name} />
          )}
          <span className="portrait-caption">
            <Heart size={13} />
            Loved, always
          </span>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Today’s care</h2>
          <p>The latest little acts of love for {pet!.name}.</p>
        </div>
        {latest.dataUpdatedAt > 0 && (
          <span className="sample-label">
            Checked {format(new Date(latest.dataUpdatedAt), 'h:mm a')}
          </span>
        )}
      </div>
      {latest.isPending && <LoadState />}
      {latest.isError && <ErrorState error={latest.error} retry={() => void latest.refetch()} />}
      {latest.data && (
        <div className="activity-grid">
          {latest.data.map((row) => {
            const type = row.activity_type;
            const Icon = icons[type.icon] ?? PawPrint;
            const tone = ['sage', 'peach', 'lavender', 'blue'].includes(type.color)
              ? type.color
              : 'sage';
            const date = row.latest ? new Date(row.latest.performed_at) : null;
            return (
              <article className="activity-card" key={type.id}>
                <div className="card-top">
                  <span className={`activity-icon ${tone}`}>
                    <Icon size={23} />
                  </span>
                </div>
                <h3>{type.name}</h3>
                {date ? (
                  <>
                    <p className="relative-time">
                      {formatDistanceToNow(date, { addSuffix: true })}
                    </p>
                    <p className="last-time">
                      {isToday(date)
                        ? 'Today'
                        : isYesterday(date)
                          ? 'Yesterday'
                          : format(date, 'MMM d, yyyy')}{' '}
                      at {format(date, 'h:mm a')}
                    </p>
                    <div className="caretaker">
                      <span className="mini-avatar">{row.latest!.performed_by_name[0]}</span>
                      <span>
                        By <strong>{row.latest!.performed_by_name}</strong>
                      </span>
                      <Check size={14} />
                    </div>
                    {row.latest!.notes && <p className="activity-note">{row.latest!.notes}</p>}
                  </>
                ) : (
                  <div className="empty-activity">
                    <p>Not recorded yet</p>
                    <span>Be the first to log a little care.</span>
                  </div>
                )}
                <button className={`log-button ${tone}`} onClick={() => setActivity(type)}>
                  <Plus size={18} />
                  Log {type.name.toLowerCase()}
                </button>
              </article>
            );
          })}
        </div>
      )}
      {latest.data?.length === 0 && (
        <p className="subtext">
          No active care activities. Please contact your household administrator.
        </p>
      )}
      <div className="team-strip">
        <div className="avatar-stack">
          {members.data?.slice(0, 3).map((m) => (
            <span key={m.user_id}>{m.profile?.display_name[0] ?? '?'}</span>
          ))}
        </div>
        <p>
          A whole household of love.
          <small>
            {members.data?.length} {members.data?.length === 1 ? 'person is' : 'people are'} on{' '}
            {pet!.name}’s team.
          </small>
        </p>
        <Heart size={21} />
      </div>
      {activity && (
        <LiveLogSheet
          activity={activity}
          onClose={() => setActivity(null)}
          onSaved={() => {
            setActivity(null);
            setToast(`${pet!.name}’s ${activity.name.toLowerCase()} has been logged! 🐾`);
          }}
        />
      )}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <Check size={18} />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
