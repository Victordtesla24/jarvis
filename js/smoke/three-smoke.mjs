import * as THREE from 'three';

const rev = parseInt(THREE.REVISION, 10);
if (isNaN(rev) || rev < 169) {
  console.error('FAIL: THREE REVISION', THREE.REVISION, 'below minimum 169');
  process.exit(1);
}
console.log('THREE r' + THREE.REVISION);
