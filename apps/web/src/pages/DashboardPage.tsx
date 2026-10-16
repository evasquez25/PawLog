import { useEffect, useState } from 'react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import {
  Bone,
  Trees,
  Footprints,
  Droplets,
  Plus,
  ChevronDown,
  Check,
  Heart,
  PawPrint,
} from 'lucide-react';
import { useDemo } from '@/contexts/DemoContext';
import { activities, latestLog, pets, type ActivityId } from '@/lib/demo';
import { PetPortrait } from '@/components/pets/PetPortrait';
import { LogSheet } from '@/components/activities/LogSheet';
const icons = { feeding: Bone, potty: Trees, walking: Footprints, bathing: Droplets };
export function DashboardPage() {
  const { name, petId, setPetId, logs } = useDemo();
  const pet = pets.find((item) => item.id === petId)!;
  const [selected, setSelected] = useState<ActivityId | null>(null);
  const [toast, setToast] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((value) => value + 1), 30000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (toast) {
      const id = window.setTimeout(() => setToast(''), 4500);
      return () => window.clearTimeout(id);
    }
  }, [toast]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const activity = activities.find((item) => item.id === selected);
  return (
    <div className="page dashboard">
      <div className="greeting-row">
        <div>
          <p className="eyebrow">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1>
            {greeting}, {name}
            <span className="greeting-dot">.</span> <span className="wave">☀</span>
          </h1>
          <p className="subtext">A happy pet starts with a little teamwork.</p>
        </div>
        <div className="care-badge">
          <Heart size={17} /> Better, together
        </div>
      </div>
      <section className="pet-hero" aria-labelledby="pet-title">
        <div className="hero-copy">
          <span className="pet-label">
            <span /> YOUR LITTLE SIDEKICK
          </span>
          <h2 id="pet-title">
            How’s {pet.name}
            <br />
            doing today?
          </h2>
          <p>All their care. All in one happy place.</p>
          <div className="pet-select-wrap">
            <PawPrint size={16} />
            <select
              aria-label="Selected pet"
              value={petId}
              onChange={(event) => setPetId(event.target.value)}
            >
              {pets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.breed}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
        <div className="portrait-wrap">
          <div className="hero-spark spark-one">✦</div>
          <PetPortrait cat={petId === 'luna'} />
          <span className="portrait-caption">
            <Heart size={13} fill="currentColor" /> Very good {petId === 'luna' ? 'cat' : 'dog'}
          </span>
          <div className="hero-spark spark-two">✧</div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Today’s care</h2>
          <p>The latest little acts of love for {pet.name}.</p>
        </div>
        <span className="sample-label">Sample records</span>
      </div>
      <div className="activity-grid">
        {activities.map((item) => {
          const Icon = icons[item.id];
          const latest = latestLog(logs, petId, item.id);
          const date = latest ? new Date(latest.time) : null;
          return (
            <article className="activity-card" key={item.id}>
              <div className="card-top">
                <span className={`activity-icon ${item.tone}`}>
                  <Icon size={23} />
                </span>
                <span className="card-kicker">{item.hint}</span>
              </div>
              <h3>{item.name}</h3>
              {date ? (
                <>
                  <p className="relative-time">{formatDistanceToNow(date, { addSuffix: true })}</p>
                  <p className="last-time">
                    {isToday(date)
                      ? 'Today'
                      : isYesterday(date)
                        ? 'Yesterday'
                        : format(date, 'MMM d, yyyy')}{' '}
                    at {format(date, 'h:mm a')}
                  </p>
                  <div className="caretaker">
                    <span className={`mini-avatar ${latest!.member.toLowerCase()}`}>
                      {latest!.member[0]}
                    </span>
                    <span>
                      By <strong>{latest!.member === 'Eric' ? name : latest!.member}</strong>
                    </span>
                    <Check size={14} />
                  </div>
                </>
              ) : (
                <div className="empty-activity">
                  <p>Not recorded yet</p>
                  <span>Be the first to log a little care.</span>
                </div>
              )}
              <button className={`log-button ${item.tone}`} onClick={() => setSelected(item.id)}>
                <Plus size={18} /> Log {item.name.toLowerCase()}
              </button>
            </article>
          );
        })}
      </div>
      <div className="team-strip">
        <div className="avatar-stack">
          <span>E</span>
          <span>S</span>
          <span>A</span>
        </div>
        <p>
          A whole household of love.<small>You, Sarah, and Alex are on {pet.name}’s team.</small>
        </p>
        <Heart size={21} />
      </div>
      {activity && (
        <LogSheet
          key={activity.id}
          activity={activity}
          petName={pet.name}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setToast(`${pet.name}’s ${activity.verb} was added to this demo. 🐾`);
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
