import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import CoreLab from './components/relativity/CoreLab';
import AtomicOrbitals from './components/relativity/AtomicOrbitals';

// Theatre.js Studio is the visual keyframe editor — dev-only, never shipped to production.
// Kept collapsed by default so it doesn't cover the dashboard; append ?studio to open it.
if (import.meta.env.DEV) {
  import('@theatre/studio').then(({ default: studio }) => {
    studio.initialize();
    if (typeof window !== 'undefined' && !window.location.search.includes('studio')) {
      studio.ui.hide();
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Lab routes for isolated iteration: ?core (reactor) · ?orbitals (atomic orbitals).
const q = typeof window !== 'undefined' ? window.location.search : '';
const view = q.includes('orbitals')
  ? <div style={{ position: 'fixed', inset: 0, background: '#000' }}><AtomicOrbitals /></div>
  : q.includes('core') ? <CoreLab /> : <App />;

const root = ReactDOM.createRoot(rootElement);
// Arwes (@arwes/react) requires React's development double-invoke wrapper to be removed:
// that wrapper's double mount/unmount breaks its animator + frame-assembler lifecycle.
root.render(<>{view}</>);
