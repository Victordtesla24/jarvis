import Meyda from 'meyda';

if (!Meyda || typeof Meyda.extract !== 'function') {
  console.error('FAIL: Meyda.extract is not a function');
  process.exit(1);
}

const buf = new Float32Array(512);
// Fill with a sine wave so RMS is non-trivial
for (let i = 0; i < 512; i++) buf[i] = Math.sin(i * 0.1) * 0.5;

const rms = Meyda.extract('rms', buf);
if (typeof rms !== 'number' || isNaN(rms)) {
  console.error('FAIL: Meyda.extract("rms") returned', rms);
  process.exit(1);
}
console.log('Meyda OK');
