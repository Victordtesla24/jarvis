// HolographicMaterial — a Fresnel rim-glow + animated-scanline hologram shader,
// derived from ektogamat/threejs-holographic-material (MIT), adapted for this
// project's TypeScript + declarative R3F usage. It is applied additively as a
// holographic shell around existing meshes (e.g. the textured globe) so the
// underlying detail is preserved and gains a gold Stark-HUD rim.
import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';

const HolographicShaderMaterial = shaderMaterial(
  {
    time: 0,
    hologramColor: new THREE.Color('#C9A84C'),
    fresnelOpacity: 0.5,
    fresnelAmount: 0.45,
    scanlineSize: 8.0,
    signalSpeed: 0.45,
    hologramOpacity: 1.0,
    enableAdditive: true,
  },
  /* glsl vertex */ `
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vPosition = position;
      vNormal   = normalize(normalMatrix * normal);
      vUv       = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl fragment */ `
    uniform float time;
    uniform vec3  hologramColor;
    uniform float fresnelOpacity;
    uniform float fresnelAmount;
    uniform float scanlineSize;
    uniform float signalSpeed;
    uniform float hologramOpacity;
    uniform bool  enableAdditive;

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    float scanline(vec2 uv, float count, float t) {
      return step(0.5, fract((uv.y + t * 0.2) * count));
    }

    void main() {
      // Fresnel
      vec3  viewDir  = normalize(cameraPosition - vPosition);
      float fresnel  = pow(1.0 - dot(vNormal, viewDir), 3.0);
      fresnel        = clamp(fresnel * fresnelAmount, 0.0, 1.0);

      // Scanlines
      float scan1    = scanline(vUv, scanlineSize, time * signalSpeed);
      float scan2    = scanline(vUv, scanlineSize * 3.0, time * signalSpeed * 0.6);
      float scanMask = mix(scan1, scan2, 0.4);

      // Signal flicker
      float flicker  = fract(sin(time * 127.1 + vUv.y * 91.0) * 43758.5453);
      float signal   = mix(1.0, flicker, 0.04);

      // Compose
      float alpha    = fresnel * fresnelOpacity + scanMask * 0.12 + 0.05;
      alpha         *= hologramOpacity * signal;

      gl_FragColor   = vec4(hologramColor, clamp(alpha, 0.0, 1.0));
      if (enableAdditive) gl_FragColor.rgb *= gl_FragColor.a;
    }
  `,
);

extend({ HolographicShaderMaterial });

// The declarative element accepts uniform values directly, so its prop types must
// match the live uniform types (e.g. a THREE.Color for hologramColor) — distinct
// from the public component API below which takes a friendly string colour.
interface HolographicShaderMaterialUniforms {
  time?: number;
  hologramColor?: THREE.Color;
  fresnelOpacity?: number;
  fresnelAmount?: number;
  scanlineSize?: number;
  signalSpeed?: number;
  hologramOpacity?: number;
  enableAdditive?: boolean;
}

declare module '@react-three/fiber' {
  interface ThreeElements {
    holographicShaderMaterial: React.JSX.IntrinsicElements['shaderMaterial'] &
      HolographicShaderMaterialUniforms;
  }
}

export interface HolographicMaterialProps {
  hologramColor?: string;
  fresnelOpacity?: number;
  fresnelAmount?: number;
  scanlineSize?: number;
  signalSpeed?: number;
  hologramOpacity?: number;
  enableAdditive?: boolean;
}

export function HolographicMaterial({
  hologramColor = '#C9A84C',
  fresnelOpacity = 0.5,
  fresnelAmount = 0.45,
  scanlineSize = 8,
  signalSpeed = 0.45,
  hologramOpacity = 1.0,
  enableAdditive = true,
}: HolographicMaterialProps) {
  const ref = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      (ref.current as THREE.ShaderMaterial & { time: number }).time = clock.getElapsedTime();
    }
  });

  return (
    <holographicShaderMaterial
      ref={ref}
      key={HolographicShaderMaterial.key}
      hologramColor={new THREE.Color(hologramColor)}
      fresnelOpacity={fresnelOpacity}
      fresnelAmount={fresnelAmount}
      scanlineSize={scanlineSize}
      signalSpeed={signalSpeed}
      hologramOpacity={hologramOpacity}
      enableAdditive={enableAdditive}
      transparent
      depthWrite={false}
      side={THREE.FrontSide}
      blending={enableAdditive ? THREE.AdditiveBlending : THREE.NormalBlending}
    />
  );
}
