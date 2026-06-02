// Theatre.js project bootstrap for the JARVIS dashboard. The keyframed sequences for
// the boot power-on envelope and the console reveal are shipped inline (below) so no
// Theatre Studio .json save-file needs to be committed — the format is the
// @theatre/core 0.7 PositionalSequence state (tracksByObject / trackData).
//
// Studio (the visual editor) is loaded dev-only from main.tsx; this module is
// studio-free so it is safe to import in production and in tests.
import { getProject, types } from '@theatre/core';

type KeyPoint = [position: number, value: number];

// Build a BasicKeyframedTrack (eased bezier handles) from [position, value] points.
function track(name: string, points: KeyPoint[]) {
  return {
    type: 'BasicKeyframedTrack' as const,
    __debugName: name,
    keyframes: points.map(([position, value], i) => ({
      id: `${name}-k${i}`,
      position,
      value,
      handles: [0.5, 0, 0.5, 1] as [number, number, number, number],
      connectedRight: true,
      type: 'bezier' as const,
    })),
  };
}

// Inline keyframe state — see schema note above. Object keys and prop paths must match
// the objects created in BootSequence.tsx / JarvisConsole.tsx. The envelope fields
// (definitionVersion / revisionHistory) are required by @theatre/core's state validator.
const state = {
  definitionVersion: '0.4.0',
  revisionHistory: [] as string[],
  sheetsById: {
    BootSequence: {
      staticOverrides: { byObject: {} },
      sequence: {
        type: 'PositionalSequence' as const,
        length: 0.8,
        subUnitsPerUnit: 30,
        tracksByObject: {
          'boot-overlay': {
            trackIdByPropPath: {
              '["opacity"]': 'boot-opacity',
              '["translateY"]': 'boot-translateY',
              '["scale"]': 'boot-scale',
            },
            trackData: {
              'boot-opacity': track('opacity', [[0, 0], [0.8, 1]]),
              'boot-translateY': track('translateY', [[0, 10], [0.8, 0]]),
              'boot-scale': track('scale', [[0, 0.99], [0.8, 1]]),
            },
          },
        },
      },
    },
    JarvisConsole: {
      staticOverrides: { byObject: {} },
      sequence: {
        type: 'PositionalSequence' as const,
        length: 2,
        subUnitsPerUnit: 30,
        tracksByObject: {
          'console-lines': {
            trackIdByPropPath: {
              '["linesVisible"]': 'console-linesVisible',
              '["opacity"]': 'console-opacity',
            },
            trackData: {
              'console-linesVisible': track('linesVisible', [[0, 0], [2, 12]]),
              'console-opacity': track('opacity', [[0, 0], [0.8, 1]]),
            },
          },
        },
      },
    },
  },
};

export const theatreProject = getProject('JARVIS-Holographic', { state });

export const bootSheet = theatreProject.sheet('BootSequence');
export const consoleSheet = theatreProject.sheet('JarvisConsole');

export { types };
