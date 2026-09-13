"use strict";
/**
 * selectors：由 state ＋ data 導出的唯讀值（規格 §2「淨資產」、§7、§8.3）。
 * 全部為純函數，不修改輸入。UI 不得自行計算這些值。
 */

/** 在 list 中依 id 查表；找不到回傳 undefined。 */
function byId(list, id) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return undefined;
}

/** 玩家已購資產卡的物件陣列（依購買順序）。 */
function ownedAssets(state, playerId, data) {
  var ids = state.players[playerId].assets;
  var out = [];
  for (var i = 0; i < ids.length; i++) {
    var card = byId(data.assets.assets, ids[i]);
    if (card) out.push(card);
  }
  return out;
}

/** 玩家擁有的、指定效果型別的資產卡。 */
function assetsWithEffect(state, playerId, data, effectType) {
  return ownedAssets(state, playerId, data).filter(function (card) {
    return card.effect && card.effect.type === effectType;
  });
}

/** R-03：淨資產 ＝ cash ＋ 已購資產 value 總和（pendingIncome 不算）。 */
function netWorth(state, playerId, data) {
  var p = state.players[playerId];
  var total = p.cash;
  var cards = ownedAssets(state, playerId, data);
  for (var i = 0; i < cards.length; i++) total += cards[i].value;
  return total;
}

/** R-16：門檻 ＝ balance.blackSwanThreshold ＋ 所有 THRESHOLD_PLUS 的 param（可疊加）。 */
function threshold(state, playerId, data) {
  var base = data.balance.blackSwanThreshold;
  var cards = assetsWithEffect(state, playerId, data, "THRESHOLD_PLUS");
  for (var i = 0; i < cards.length; i++) base += cards[i].effect.param;
  return base;
}

/**
 * R-12／R-23：可抽候選集。回傳「bag 索引」陣列（依 bag 順序）。
 * luckyActive 時排除 blackSwan；否則整個 bag。
 * 回傳索引而非 tokenId，讓 reducer 能以 nextInt(候選數) 直接定位要移出的籌碼。
 */
function candidates(state, playerId) {
  var p = state.players[playerId];
  var out = [];
  for (var i = 0; i < p.bag.length; i++) {
    if (p.luckyActive && p.bag[i] === "blackSwan") continue;
    out.push(i);
  }
  return out;
}

/** 袋中各籌碼數量統計 `{ [tokenId]: count }`，供 UI 顯示剩餘。 */
function bagSummary(state, playerId) {
  var bag = state.players[playerId].bag;
  var out = {};
  for (var i = 0; i < bag.length; i++) {
    out[bag[i]] = (out[bag[i]] || 0) + 1;
  }
  return out;
}

/** bag 中 blackSwan 的數量（只看 bag，不看 drawn；BUY_INSURANCE 前置條件用）。 */
function bagBlackSwanCount(state, playerId) {
  var bag = state.players[playerId].bag;
  var n = 0;
  for (var i = 0; i < bag.length; i++) if (bag[i] === "blackSwan") n++;
  return n;
}

module.exports = {
  byId: byId,
  ownedAssets: ownedAssets,
  assetsWithEffect: assetsWithEffect,
  netWorth: netWorth,
  threshold: threshold,
  candidates: candidates,
  bagSummary: bagSummary,
  bagBlackSwanCount: bagBlackSwanCount
};
