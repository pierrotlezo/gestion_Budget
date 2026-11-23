import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout, SectionLayout } from './app/Layout';
import { sections } from './app/routes';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          {sections.map((s) => (
            <Route key={s.path} path={s.path} element={<SectionLayout section={s} />}>
              {s.pages.map((p) => (p.path ? <Route key={p.path} path={p.path} element={<p.element />} /> : <Route key="index" index element={<p.element />} />))}
            </Route>
          ))}
          <Route path="*" element={<Navigate to={sections[0].path} replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
