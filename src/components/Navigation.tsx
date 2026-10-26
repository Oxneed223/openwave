import { Link, NavLink } from "react-router-dom";
import { AudioLines, Home, Library, Menu, Search } from "lucide-react";
import { useUi } from "../store/ui";
import { cn } from "../lib/format";

export function MobileTopbar() {
  const toggleSidebar = useUi((state) => state.toggleSidebar);

  return (
    <header className="mobile-topbar">
      <button
        type="button"
        className="icon-btn"
        onClick={toggleSidebar}
        aria-label="Открыть меню"
      >
        <Menu size={22} />
      </button>
      <Link to="/" className="mobile-brand">
        <AudioLines size={19} strokeWidth={2.3} />
        <span>OpenWave</span>
      </Link>
      <Link to="/search" className="icon-btn" aria-label="Поиск">
        <Search size={21} />
      </Link>
    </header>
  );
}

const ITEMS = [
  { to: "/", label: "Главная", icon: Home, end: true },
  { to: "/search", label: "Поиск", icon: Search, end: false },
  { to: "/library", label: "Коллекция", icon: Library, end: false }
];

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Мобильная навигация">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => cn("mobile-nav-link", isActive && "active")}
        >
          <item.icon size={21} strokeWidth={1.9} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
