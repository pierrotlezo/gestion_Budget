import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './app/Layout';
import { routes } from './app/routes';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          {routes.map((r) => (
            <Route key={r.path} path={r.path} element={<r.element />} />
          ))}
          <Route path="*" element={<Navigate to={routes[0].path} replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
