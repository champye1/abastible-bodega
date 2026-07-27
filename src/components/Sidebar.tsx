import { NavLink } from 'react-router-dom';
import { ShoppingCart, Boxes, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

function AbastibleLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#F97316" />
      <path
        d="M16 7C16 7 10 12 10 17.5C10 20.5376 12.6863 23 16 23C19.3137 23 22 20.5376 22 17.5C22 12 16 7 16 7Z"
        fill="white"
        opacity="0.95"
      />
      <path
        d="M16 23V13"
        stroke="#F97316"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NAV = [
  { to: '/venta-local', icon: ShoppingCart, label: 'Venta Local'          },
  { to: '/inventario',  icon: Boxes,        label: 'Inventario Cilindros' },
];

export default function Sidebar({ onClose }: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-14 flex-shrink-0"
        style={{ borderBottom: '1px solid #1e2432' }}>
        <AbastibleLogo />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-white tracking-wide">Abastible</span>
          <span className="text-[10px] font-medium" style={{ color: '#fb923c' }}>
            Gestión Bodega GLP
          </span>
        </div>
        <button
          className="ml-auto lg:hidden p-1 rounded text-slate-500 hover:text-white transition-colors"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      {/* Location badge */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: '#1e2432', border: '1px solid #2d3748' }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#34d399' }} />
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-semibold text-white">Planta Santiago</span>
            <span className="text-[10px]" style={{ color: '#4a5568' }}>Pudahuel — RM</span>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2" style={{ color: '#4a5568' }}>
          Módulos
        </p>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-150
              ${isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}
            `}
            style={({ isActive }) => isActive ? { background: '#431407', color: '#fb923c' } : {}}
          >
            {({ isActive }) => (
              <>
                <Icon size={17} style={{ color: isActive ? '#f97316' : undefined }} />
                <span className="flex-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 text-[11px]"
        style={{ borderTop: '1px solid #1e2432', color: '#4a5568' }}>
        <p className="font-medium text-slate-500">Sistema Bodega v1.0</p>
        <p>© 2026 Abastible S.A.</p>
      </div>
    </div>
  );
}
