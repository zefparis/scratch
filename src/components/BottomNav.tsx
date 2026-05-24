import { NavLink } from 'react-router-dom';

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
        <span className="icon">🏠</span>
        <span>ACCUEIL</span>
      </NavLink>
      <NavLink to="/scratch" className={({ isActive }) => (isActive ? 'active' : '')}>
        <span className="icon">🎫</span>
        <span>SCRATCH</span>
      </NavLink>
      <NavLink to="/games" className={({ isActive }) => (isActive ? 'active' : '')}>
        <span className="icon">🎰</span>
        <span>JEUX</span>
      </NavLink>
      <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
        <span className="icon">⚙️</span>
        <span>ADMIN</span>
      </NavLink>
    </nav>
  );
}
