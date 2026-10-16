import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { UserRound, House, PawPrint, LogOut, RotateCcw, ArrowUpRight } from 'lucide-react';
import { useDemo } from '@/contexts/DemoContext';
import { members, pets } from '@/lib/demo';
import { Button } from '@/components/ui/button';
export function SettingsPage() {
  const demo = useDemo();
  const navigate = useNavigate();
  const [name, setName] = useState(demo.name);
  const [household, setHousehold] = useState(demo.household);
  const [message, setMessage] = useState('');
  const pet = pets.find((item) => item.id === demo.petId)!;
  return (
    <div className="page settings-page">
      <p className="eyebrow">YOUR SHARED SPACE</p>
      <h1>A home for your household.</h1>
      <p className="subtext">The humans and little companions behind the care.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || !household.trim()) return;
          demo.setName(name.trim());
          demo.setHousehold(household.trim());
          setMessage('Demo settings updated for this tab.');
        }}
      >
        <section className="settings-card">
          <h2>
            <UserRound size={20} />
            Your profile
          </h2>
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            maxLength={60}
            required
            pattern=".*\S.*"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <p className="field-hint">Your household sees this name alongside your care.</p>
        </section>
        <section className="settings-card">
          <h2>
            <House size={20} />
            Household
          </h2>
          <label htmlFor="household-name">Household name</label>
          <input
            id="household-name"
            maxLength={80}
            required
            pattern=".*\S.*"
            value={household}
            onChange={(event) => setHousehold(event.target.value)}
          />
          <h3 className="members-title">The care crew</h3>
          {members.map((person, index) => (
            <div className="member-row" key={person}>
              <span className={`mini-avatar ${person.toLowerCase()}`}>{person[0]}</span>
              <span>{index === 0 ? demo.name : person}</span>
              <span className="role-badge">{index === 0 ? 'Admin · you' : 'Member'}</span>
            </div>
          ))}
          <p className="field-hint">Create real invitations in your household settings.</p>
        </section>
        <section className="settings-card">
          <h2>
            <PawPrint size={20} />
            Active pet
          </h2>
          <label htmlFor="active-pet">Your companion</label>
          <select
            id="active-pet"
            value={demo.petId}
            onChange={(event) => demo.setPetId(event.target.value)}
          >
            {pets.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} · {item.species}
              </option>
            ))}
          </select>
          <p className="field-hint">
            {pet.name} · {pet.breed}. Manage real pets in your household settings.
          </p>
        </section>
        <Button type="submit" className="min-h-11">
          Save demo settings
        </Button>
        <p role="status" className="settings-feedback">
          {message}
        </p>
      </form>
      <section className="settings-card prototype-settings">
        <h2>About this prototype</h2>
        <p>
          This sample household uses only in-memory data. Changes here never affect your real
          account.
        </p>
        <Link to="/app">
          Your real account <ArrowUpRight size={16} />
        </Link>
        <button
          onClick={() => {
            demo.reset();
            setName('Eric');
            setHousehold('The Vasquez household');
            setMessage('Sample data reset.');
          }}
        >
          <RotateCcw size={17} />
          Reset sample data
        </button>
        <button
          onClick={() => {
            demo.reset();
            navigate('/login');
          }}
        >
          <LogOut size={17} />
          Exit demo
        </button>
      </section>
    </div>
  );
}
