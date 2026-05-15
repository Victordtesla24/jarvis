import * as OGL from 'ogl';
import createREGL from 'regl';

if (!OGL || typeof OGL.Renderer === 'undefined') {
  console.error('FAIL: OGL Renderer not exported');
  process.exit(1);
}
console.log('OGL OK');

if (typeof createREGL !== 'function') {
  console.error('FAIL: regl default export is not a function');
  process.exit(1);
}
console.log('regl OK');
