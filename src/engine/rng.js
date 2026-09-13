"use strict";
/**
 * seeded RNG：mulberry32（依 ADR-001 §2.2）。
 * - 狀態只有一個 uint32（`{ s }`），直接放進 state.rng，重放只需記 seed。
 * - 每次呼叫回傳「新狀態 ＋ 值」，不使用閉包或可變內部狀態（純函數）。
 * - 只用 Math.imul 與 >>>，Node 與 iPad Safari 行為一致。
 * 下列十六進位常數為演算法常數，不是遊戲平衡數值。
 */

/** 以 seed 建立 RNG 狀態；seed 會被強制轉成 uint32。 */
function seedRng(seed) {
  return { s: seed >>> 0 };
}

/** 取下一個亂數。回傳 { rng: 新狀態, value: [0,1) 浮點 }。 */
function next(rng) {
  var t = (rng.s + 0x6D2B79F5) >>> 0;
  var r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return { rng: { s: t }, value: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
}

/** 取 0..n-1 的整數（n ≥ 1）。回傳 { rng, value }。 */
function nextInt(rng, n) {
  var o = next(rng);
  return { rng: o.rng, value: Math.floor(o.value * n) };
}

module.exports = { seedRng: seedRng, next: next, nextInt: nextInt };
