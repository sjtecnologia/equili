import { NavLink } from 'react-router-dom'
import { useNavStore } from '@/stores/navStore'
import { ALL_NAV_ITEMS } from '@/config/navItems'

export default function BottomNav() {
  const { shortcuts } = useNavStore()
  const items = ALL_NAV_ITEMS.filter((item) => shortcuts.includes(item.to))

  return (
    <nav style={{ backgroundColor: '#ffffff', borderTop: '2px solid #2E7D5E' }}>
      <div className="flex justify-around px-1 py-1.5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 rounded text-xs font-medium transition-colors duration-150 flex-1 min-w-0 ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`
            }
          >
            <Icon size={20} />
            <span className="truncate max-w-full px-1 text-center leading-tight">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

