import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Silence Three.js and WebGL noise in tests by mocking the heavy 3D/render components.
// The real 3D rendering + gesture reactivity is verified separately via headless-browser
// screenshots; this suite unit-tests App's boot/toggle state machine.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
}));
vi.mock('./components/HolographicEarth', () => ({
  default: () => <div data-testid="holographic-earth" />,
}));
vi.mock('./components/HUDOverlay', () => ({
  default: () => <div data-testid="hud-overlay" />,
}));
// The cinematic boot is mocked to a button that fires onComplete on click, so the
// suite can drive the boot→dashboard transition without rAF/WebGL.
vi.mock('./components/BootSequence', () => ({
  default: ({ onComplete }: { onComplete: () => void }) => (
    <button data-testid="boot-sequence" onClick={onComplete}>__COMPLETE_BOOT__</button>
  ),
}));
vi.mock('./components/relativity/ReactorCore3D', () => ({
  default: () => <div data-testid="reactor-core" />,
}));
vi.mock('./components/relativity/RelativityHUD', () => ({
  default: ({ minimal }: { minimal?: boolean }) => <div data-testid="relativity-hud" data-minimal={String(!!minimal)} />,
}));
vi.mock('./components/relativity/HoloGlass', () => ({
  default: () => <div data-testid="holo-glass" />,
}));
vi.mock('./components/relativity/HudBackdrop', () => ({
  default: () => <div data-testid="hud-backdrop" />,
}));
vi.mock('./components/JarvisConsole', () => ({
  default: () => <div data-testid="jarvis-console" />,
}));
vi.mock('./components/GestureController', () => ({
  default: () => <div data-testid="gesture-controller" />,
}));
vi.mock('./components/widgets/GestureDeck', () => ({
  default: () => <div data-testid="gesture-deck" />,
}));

function bootToDashboard() {
  render(<App />);
  fireEvent.click(screen.getByText('INITIALIZE J.A.R.V.I.S.'));
  fireEvent.click(screen.getByTestId('boot-sequence')); // fires onComplete → booted
}

describe('App boot / dashboard state machine', () => {
  it('shows INITIALIZE button on first render', () => {
    render(<App />);
    expect(screen.getByText('INITIALIZE J.A.R.V.I.S.')).toBeInTheDocument();
  });

  it('runs the cinematic boot sequence after clicking INITIALIZE', () => {
    render(<App />);
    fireEvent.click(screen.getByText('INITIALIZE J.A.R.V.I.S.'));
    expect(screen.getByTestId('boot-sequence')).toBeInTheDocument();
    expect(screen.queryByText('INITIALIZE J.A.R.V.I.S.')).not.toBeInTheDocument();
  });

  it('reaches the live dashboard after the boot completes', () => {
    bootToDashboard();
    expect(screen.getByTestId('reactor-core')).toBeInTheDocument();
    expect(screen.getByText('GLOBE')).toBeInTheDocument();
  });

  it('mounts the gesture-driven instrument deck by default (instruments mode)', () => {
    bootToDashboard();
    expect(screen.getByTestId('gesture-deck')).toBeInTheDocument();
    expect(screen.getByText('INSTRUMENTS ◉')).toBeInTheDocument();
    // RelativityHUD is rendered minimal so the deck owns the rails
    expect(screen.getByTestId('relativity-hud').getAttribute('data-minimal')).toBe('true');
  });

  it('toggles INSTRUMENTS mode off → classic dense HUD', () => {
    bootToDashboard();
    fireEvent.click(screen.getByText('INSTRUMENTS ◉'));
    expect(screen.queryByTestId('gesture-deck')).not.toBeInTheDocument();
    expect(screen.getByText('INSTRUMENTS ◌')).toBeInTheDocument();
    expect(screen.getByTestId('relativity-hud').getAttribute('data-minimal')).toBe('false');
  });

  it('toggles between reactor and globe views', () => {
    bootToDashboard();
    expect(screen.getByTestId('reactor-core')).toBeInTheDocument();
    fireEvent.click(screen.getByText('GLOBE'));
    expect(screen.getByTestId('holographic-earth')).toBeInTheDocument();
    expect(screen.getByText('REACTOR')).toBeInTheDocument();
    fireEvent.click(screen.getByText('REACTOR'));
    expect(screen.getByTestId('reactor-core')).toBeInTheDocument();
  });

  it('does not throw on unmount', () => {
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByText('INITIALIZE J.A.R.V.I.S.'));
    expect(() => unmount()).not.toThrow();
  });
});
