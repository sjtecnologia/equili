import { NavLink } from 'react-router-dom'
import { useNavStore } from '@/stores/navStore'
import { ALL_NAV_ITEMS, requiresExactActiveMatch } from '@/config/navItems'

export default function BottomNav() {
  const { shortcuts } = useNavStore()
  const items = ALL_NAV_ITEMS.filter((item) => shortcuts.includes(item.to))

  return (
    <nav style={{
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      maxWidth: '100%',
      overflowX: 'hidden',
      backgroundColor: '#ffffff',
      borderTop: '2px solid #2E7D5E',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 20,
    }}>
      <div className="flex flex-row w-full max-w-full overflow-x-hidden justify-around px-1 py-1.5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={requiresExactActiveMatch(to)}
            className={({ isActive }) =>
              `flex flex-[1_1_0] min-w-0 max-w-full flex-col items-center gap-0.5 py-1 rounded text-xs font-medium transition-colors duration-150 ${
                isActive ? 'text-primary-500' : 'text-gray-400'
              }`
            }
          >
            <Icon size={20} />
            <span className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-1 text-center text-[11px] leading-tight">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
