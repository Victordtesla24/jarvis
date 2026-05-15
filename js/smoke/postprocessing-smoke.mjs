import { EffectComposer } from 'postprocessing';

if (typeof EffectComposer !== 'function') {
  console.error('FAIL: EffectComposer is not a class');
  process.exit(1);
}
console.log('EffectComposer OK');
