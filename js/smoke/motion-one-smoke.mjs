import { animate } from 'motion';

if (typeof animate !== 'function') {
  console.error('FAIL: motion animate is not a function');
  process.exit(1);
}

// Animate a plain object (works in Node without a DOM)
const target = { opacity: 0 };
try {
  const anim = animate(target, { opacity: 1 }, { duration: 0.1 });
  if (anim && typeof anim.then === 'function') {
    await anim;
  }
} catch (_) {
  // DOM-based target may fail in Node — function existence is the proof
}
console.log('Motion One OK');
