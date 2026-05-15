// @tsparticles/engine v3 exports tsParticles singleton (not a class named Engine)
import { tsParticles } from '@tsparticles/engine';

if (!tsParticles || typeof tsParticles.init !== 'function') {
  console.error('FAIL: tsParticles.init is not a function');
  process.exit(1);
}

// particlesInit — initialise with a no-op loader to verify the pipeline resolves
await tsParticles.init(async (_engine) => {
  // engine initialised, no loaders needed for smoke test
});

console.log('tsParticles OK');
