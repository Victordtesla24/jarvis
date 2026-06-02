import React, { useRef } from 'react';
import ReactorCore3D from './ReactorCore3D';
import { HandTrackingState } from '../../types';

// Standalone lab for iterating on the 3D reactor core against the reference video,
// isolated from the dashboard. Open with ?core in the URL. Pure black background.
const CoreLab: React.FC = () => {
  const hands = useRef<HandTrackingState>({ leftHand: null, rightHand: null });
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      <ReactorCore3D handTrackingRef={hands} />
      <div style={{ position: 'absolute', bottom: 12, left: 12, color: '#3a6680', font: '10px monospace', letterSpacing: 2 }}>
        CORE LAB · drag = orbit · wheel = split
      </div>
    </div>
  );
};

export default CoreLab;
