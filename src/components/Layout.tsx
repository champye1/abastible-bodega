import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

const MODULE_LABELS: Record<string, string> = {
  '/venta-local': 'Venta Local',
  '/inventario':  'Inventario Cilindros',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const currentLabel = MODULE_LABELS[location.pathname] ?? 'Bodega';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0f1117' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-30 w-60 flex-shrink-0
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: '#0d1117', borderRight: '1px solid #1e2432' }}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center gap-3 px-5 h-14 flex-shrink-0"
          style={{ background: '#0d1117', borderBottom: '1px solid #1e2432' }}
        >
          <button
            className="lg:hidden p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium text-slate-400 hidden sm:block whitespace-nowrap">
              Abastible Bodega
            </span>
            <span className="text-slate-600 hidden sm:block">/</span>
            <span
              className="text-sm font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: '#431407', color: '#fb923c' }}
            >
              {currentLabel}
            </span>
          </div>

          {/* Usuario */}
          <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-medium text-white">Operador Bodega</span>
              <span className="text-[10px]" style={{ color: '#4a5568' }}>Planta Santiago</span>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: '#F97316', color: '#fff' }}>
              AB
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5" style={{ background: '#1a1d23' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
