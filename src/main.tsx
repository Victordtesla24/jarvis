import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import CoreLab from './components/relativity/CoreLab';
import AtomicOrbitals from './components/relativity/AtomicOrbitals';

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
root.render(<React.StrictMode>{view}</React.StrictMode>);
