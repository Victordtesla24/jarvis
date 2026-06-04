import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReactorCoreHUD from './ReactorCoreHUD';

// These lock in the "HUD Relativity" dial MOTION the reference video (youtu.be/yXpkIrR81w8)
// shows on its core dials at 1:15 / 1:20 / 1:36: a continuously rotating radar scan sweep,
// a dense technical field counter-rotating against the graduation tick ring, and an
// entrance reveal. They are the animations this centrepiece was missing.
describe('ReactorCoreHUD — HUD Relativity dial motion', () => {
  it('renders the reactor core centrepiece', () => {
    render(<ReactorCoreHUD />);
    expect(screen.getByText('REACTOR CORE')).toBeInTheDocument();
  });

  it('rakes the open core with a continuously rotating radar scan sweep', () => {
    render(<ReactorCoreHUD />);
    const sweep = screen.getByTestId('rc-scan-sweep');
    expect(sweep).toHaveClass('rc-sweep');                       // continuous rotation
    // a filled wedge (≥1 path) plus a bright leading edge line
    expect(sweep.querySelectorAll('path').length).toBeGreaterThanOrEqual(1);
    expect(sweep.querySelectorAll('line').length).toBeGreaterThanOrEqual(1);
  });

  it('counter-rotates a dense technical field against the graduation tick ring', () => {
    render(<ReactorCoreHUD />);
    const field = screen.getByTestId('rc-tech-field');
    const ticks = screen.getByTestId('rc-tick-ring');
    expect(field).toHaveClass('rc-field-ccw'); // inner field turns CCW
    expect(ticks).toHaveClass('rc-field-cw');  // tick ring turns CW → layered opposition
    // the field is actually dense (radial spokes + registration marks), not an empty group
    expect(field.querySelectorAll('line, rect, circle').length).toBeGreaterThanOrEqual(24);
  });

  it('reveals the dial with an entrance animation on mount', () => {
    render(<ReactorCoreHUD />);
    expect(screen.getByTestId('rc-dial')).toHaveClass('rc-reveal');
  });
});
