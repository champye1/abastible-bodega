import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import VentaLocal from './pages/VentaLocal';
import Inventario from './pages/Inventario';
import Configuracion from './pages/Configuracion';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/venta-local" replace />} />
        <Route path="venta-local" element={<VentaLocal />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
  );
}
