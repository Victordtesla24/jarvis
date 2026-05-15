// Anamorphic lens-flare fragment shader — ported from the MIT-licensed
// "Anamorphic Lens Flare" Godot shader by iamyoki / Arkhan (ShaderToy inspiration).
// Contributes a horizontal streak + radial bloom typical of anamorphic optics.
// Registered as a ShaderPass in the pmndrs/postprocessing composer.

export const anamorphicFlareFragment = /* glsl */ `
uniform sampler2D inputBuffer;
uniform vec2 resolution;
uniform float flareIntensity;
uniform float flareLength;
uniform vec3 flareTint;
uniform float time;

varying vec2 vUv;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 sampleFlare(vec2 uv, vec2 dir, float spread, float steps) {
  vec3 acc = vec3(0.0);
  for (float i = 1.0; i <= 24.0; i += 1.0) {
    if (i > steps) break;
    vec2 offset = dir * (i / steps) * spread;
    vec3 s = texture2D(inputBuffer, uv + offset).rgb
           + texture2D(inputBuffer, uv - offset).rgb;
    // emphasise bright pixels — lens flares come from saturated highlights
    float l = luma(s) - 1.2;
    acc += max(s - 1.2, 0.0) * exp(-i * 0.14);
  }
  return acc / steps;
}

void main() {
  vec3 src = texture2D(inputBuffer, vUv).rgb;

  // Horizontal anamorphic streak
  vec2 hDir = vec2(1.0 / resolution.x, 0.0);
  vec3 flare = sampleFlare(vUv, hDir, flareLength, 20.0);

  // Subtle vertical bleed
  vec2 vDir = vec2(0.0, 1.0 / resolution.y);
  flare += sampleFlare(vUv, vDir, flareLength * 0.2, 8.0) * 0.35;

  // Radial flare component
  vec2 centre = vec2(0.5);
  vec2 toC = vUv - centre;
  float dist = length(toC);
  vec3 radial = sampleFlare(vUv, normalize(toC) / resolution, flareLength * 0.5, 10.0);
  flare += radial * smoothstep(0.6, 0.0, dist) * 0.6;

  // Tinted additive composite
  vec3 result = src + flare * flareTint * flareIntensity;
  gl_FragColor = vec4(result, 1.0);
}
`;

export const anamorphicFlareVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
