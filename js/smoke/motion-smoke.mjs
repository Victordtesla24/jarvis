import gsap from 'gsap';

if (typeof gsap.to !== 'function') {
  console.error('FAIL: gsap.to is not a function');
  process.exit(1);
}
const tween = gsap.to({ v: 0 }, { v: 1, duration: 0.1 });
if (!tween) {
  console.error('FAIL: gsap.to returned nothing');
  process.exit(1);
}
console.log('GSAP OK');

// animejs v4 uses named exports (no default export)
import { animate as animeAnimate } from 'animejs';

if (typeof animeAnimate !== 'function') {
  console.error('FAIL: animejs animate is not a function');
  process.exit(1);
}
const target = { v: 0 };
animeAnimate(target, { v: 1, duration: 100 });
console.log('AnimeJS OK');
