import { Application } from 'pixi.js';

if (typeof Application !== 'function') {
  console.error('FAIL: pixi.js Application not a class');
  process.exit(1);
}

// new Application() in pixi.js v8 does not require canvas at construction time
const app = new Application();
if (!(app instanceof Application)) {
  console.error('FAIL: pixi.js Application instantiation failed');
  process.exit(1);
}
console.log('PixiJS OK');
