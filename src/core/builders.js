import { PALETTE } from './palette.js';

export const BUILDERS = {};
export function registerBuilder(name, fn) { BUILDERS[name] = fn; }

export function createMaterialCache(THREE) {
  const cache = new Map();
  const emissiveMaterials = [];

  function mats(key, opts = {}) {
    const {
      emissive = 0, emissiveKey = null, opacity = 1, flat = true,
      doubleSide = false, vertexColors = false, roughness = 0.78,
      metalness = 0.06, depthWrite = true,
    } = opts;
    const sig = `${key}|${emissive}|${emissiveKey || ''}|${opacity}|${flat}|${doubleSide}|${vertexColors}|${roughness}|${metalness}|${depthWrite}`;
    if (cache.has(sig)) return cache.get(sig);

    const hex = PALETTE[key] || key || '#888888';
    const matOpts = {
      color: vertexColors ? 0xffffff : hex, flatShading: flat, roughness, metalness,
      vertexColors, transparent: opacity < 1, opacity,
      depthWrite: opacity < 1 ? depthWrite : true,
      side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    };
    if (emissive > 0) {
      const emHex = emissiveKey ? PALETTE[emissiveKey] || emissiveKey : hex;
      matOpts.emissive = new THREE.Color(emHex);
      matOpts.emissiveIntensity = 0;
    }
    const mat = new THREE.MeshStandardMaterial(matOpts);
    if (emissive > 0) {
      mat.userData.nightEmissiveIntensity = emissive;
      mat.userData.alwaysEmissive = Boolean(opts.alwaysEmissive);
      emissiveMaterials.push(mat);
    }
    cache.set(sig, mat);
    return mat;
  }

  function updateEmissives(state) {
    const active = state.night || state.cutaway || state.underground;
    const t = state.nightBlend !== undefined ? state.nightBlend : active ? 1 : 0;
    const factor = state.cutaway || state.underground ? Math.max(t, 1) : t;
    for (const mat of emissiveMaterials) {
      mat.emissiveIntensity = mat.userData.alwaysEmissive
        ? mat.userData.nightEmissiveIntensity
        : mat.userData.nightEmissiveIntensity * factor;
    }
  }
  return { mats, updateEmissives, cache };
}
