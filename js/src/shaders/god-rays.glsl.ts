// Volumetric god-rays fragment shader — ported from the MIT-licensed
// Erkaman/glsl-godrays repository (simplified radial-sweep variant).
// Integrated as a custom Effect inside the pmndrs/postprocessing composer.

export const godRaysFragment = /* glsl */ `
uniform vec2 lightScreenPos;
uniform float density;
uniform float weight;
uniform float decay;
uniform float exposure;
uniform int samples;
uniform vec3 tint;
uniform float intensity;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 texCoord = uv;
  vec2 deltaTexCoord = texCoord - lightScreenPos;
  int iSamples = samples;
  if (iSamples < 4) iSamples = 4;
  if (iSamples > 96) iSamples = 96;
  deltaTexCoord *= (1.0 / float(iSamples)) * density;
  float illuminationDecay = 1.0;
  vec3 accum = vec3(0.0);

  for (int i = 0; i < 96; i++) {
    if (i >= iSamples) break;
    texCoord -= deltaTexCoord;
    // Brighten-only radial sample — treat high-luma pixels as emitters
    vec4 samp = texture2D(inputBuffer, texCoord);
    float l = dot(samp.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 emitter = samp.rgb * smoothstep(0.35, 0.95, l);
    emitter *= illuminationDecay * weight;
    accum += emitter;
    illuminationDecay *= decay;
  }

  vec3 rays = accum * exposure * intensity * tint;
  outputColor = vec4(inputColor.rgb + rays, inputColor.a);
}
`;
