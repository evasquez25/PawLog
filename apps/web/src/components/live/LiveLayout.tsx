import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useState } from 'react';
import { PawPrint, House, Settings, LogOut, RefreshCw, WifiOff } from 'lucide-react';
import { HouseholdProvider, useHousehold } from '@/contexts/HouseholdContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOnline } from '@/hooks/useOnline';
export default function LiveRoot() {
  const { session } = useAuth();
  return (
    <HouseholdProvider key={session!.user.id}>
      <LiveLayout />
    </HouseholdProvider>
  );
}
function LiveLayout() {
  const {
    account,
    household,
    members,
    pets,
    householdId,
    setHousehold,
    refresh,
    isAdmin,
    syncStatus,
  } = useHousehold();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const name = account.data?.profile.display_name ?? 'Your account';
  async function logout() {
    setSigningOut(true);
    setError('');
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="app-shell live-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/app">
          <span className="brand-mark">
            <PawPrint />
          </span>
          PawLog.
        </Link>
        <p className="brand-tagline">Happy pets. Happy households.</p>
        <div className="household-label">YOUR SPACE</div>
        <div className="household-name">
          <span className="house-icon">
            <House size={18} />
          </span>
          <span>
            {household.data?.name ?? 'Your household'}
            <small>
              {members.data?.length ?? '–'} caring humans · {pets.data?.length ?? '–'} pets
            </small>
          </span>
        </div>
        <nav aria-label="Main navigation">
          <NavLink to="/app" end>
            <House size={20} />
            Home
          </NavLink>
          <NavLink to="/app/settings">
            <Settings size={20} />
            Settings
          </NavLink>
        </nav>
        <div className="sidebar-note">
          <PawPrint size={28} />
          <h3>
            A little teamwork.
            <br />A lot of tail wags.
          </h3>
          <p>Every small act of care makes their day a little better.</p>
        </div>
        <Link className="profile" to="/app/settings">
          <span className="avatar">{name[0]}</span>
          <span>
            {name}
            <small>
              {householdId ? (isAdmin ? 'Household admin' : 'Household member') : 'Your account'}
            </small>
          </span>
          <Settings size={17} />
        </Link>
      </aside>
      <div className="workspace">
        <header className="topbar live-topbar">
          <Link className="mobile-brand" to="/app">
            <PawPrint size={22} />
            PawLog.
          </Link>
          <span className="desktop-label">Your daily dose of care</span>
          <div className="live-header-actions">
            {householdId && (
              <span className={`care-sync ${syncStatus}`} role="status">
                <span />
                {syncStatus === 'connected'
                  ? 'Live updates connected'
                  : syncStatus === 'offline'
                    ? 'Offline'
                    : syncStatus === 'connecting'
                      ? 'Connecting updates…'
                      : 'Reconnecting · checking for updates'}
              </span>
            )}
            <button
              className="icon-button"
              aria-label="Refresh household data"
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Sign out"
              disabled={signingOut}
              onClick={() => void logout()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        {account.data && account.data.households.length > 0 && (
          <div className="household-switch">
            <label htmlFor="household-switch">Household</label>
            <select
              id="household-switch"
              value={householdId}
              onChange={(e) => setHousehold(e.target.value)}
            >
              {account.data.households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <Link to="/app/households">Create or join</Link>
          </div>
        )}
        {!online && (
          <div role="status" className="offline-banner">
            <WifiOff size={17} />
            You’re offline. Shown data may be outdated. Reconnect to save.
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          <PawPrint size={14} />
          Made for the ones who make a house a home.
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavLink to="/app" end>
          <House size={21} />
          Home
        </NavLink>
        <NavLink to="/app/settings">
          <Settings size={21} />
          Settings
        </NavLink>
      </nav>
    </div>
  );
}
