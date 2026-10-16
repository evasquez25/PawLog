import { NavLink, Link, Outlet } from 'react-router';
import { House, Settings, PawPrint, ArrowUpRight } from 'lucide-react';
import { useDemo } from '@/contexts/DemoContext';
export function AppLayout() {
  const { name, household } = useDemo();
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/demo">
          <span className="brand-mark">
            <PawPrint />
          </span>
          PawLog<span className="brand-dot">.</span>
        </Link>
        <p className="brand-tagline">Happy pets. Happy households.</p>
        <div className="household-label">YOUR SPACE</div>
        <div className="household-name">
          <span className="house-icon">
            <House size={18} />
          </span>
          <span>
            {household}
            <small>3 caring humans · 2 happy pets</small>
          </span>
        </div>
        <nav aria-label="Main navigation">
          <NavLink to="/demo" end>
            <House size={20} />
            Home
          </NavLink>
          <NavLink to="/demo/settings">
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
        <Link className="profile" to="/demo/settings">
          <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
          <span>
            {name}
            <small>Household admin · demo</small>
          </span>
          <Settings size={17} />
        </Link>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="mobile-brand">
            <PawPrint size={22} /> PawLog.
          </span>
          <span className="desktop-label">Your daily dose of care</span>
          <Link to="/login">
            Explore sign-in <ArrowUpRight size={15} />
          </Link>
        </header>
        <div className="demo-banner">
          <span className="demo-dot" />
          <strong>Prototype mode</strong>
          <span>Sample household · changes reset on refresh</span>
        </div>
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="page-footer">
          <PawPrint size={14} /> Made for the ones who make a house a home.
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        <NavLink to="/demo" end>
          <House size={21} />
          Home
        </NavLink>
        <NavLink to="/demo/settings">
          <Settings size={21} />
          Settings
        </NavLink>
      </nav>
    </div>
  );
}
