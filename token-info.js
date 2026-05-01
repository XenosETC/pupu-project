(function () {
  var BLOCKSCOUT = "https://etc.blockscout.com/api/v2";
  var ETC_RPC = "https://etc.blockscout.com/api/eth-rpc";
  var TOKEN_ADDRESS = "0x0bD01d2C68f89AbeD94BC85988fa8A6e18EFb2db";
  var LP_ADDRESS = "0x9f1a8fC0ef058F3001c1628D8130d1C5301201C9";
  var DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
  var WETC_ADDRESS = "0x82a618305706b14e7bcf2592d4b9324a366b6dad";
  var STAKE_CONTRACT = "0x547F1eE3eCe50c0F5cc998D24E9FF28793b42Ee5";
  var MULTISIG_ADDRESS = "0xE1a12E10b3E0584929f3cF21A71b8DD0fCf6cB76";

  function formatBigNumber(raw, decimals) {
    if (raw === null || raw === undefined) return "—";
    decimals = decimals || 18;
    var str = String(raw);
    if (str.length <= decimals) return "0";
    var intPart = str.slice(0, -decimals);
    var fracPart = str.slice(-decimals).replace(/0+$/, "");
    if (fracPart.length === 0) return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + fracPart;
  }

  function weiToNumber(raw, decimals) {
    if (raw === null || raw === undefined) return null;
    var d = decimals || 18;
    var str = String(raw);
    if (str.length <= d) return 0;
    return Number(str.slice(0, -d) + "." + str.slice(-d));
  }

  function formatCompact(raw, decimals) {
    if (raw === null || raw === undefined) return "—";
    var n = weiToNumber(raw, decimals || 18);
    if (n === null || isNaN(n)) return "—";
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(2).replace(/\.?0+$/, "") + "K";
    if (n >= 1) return n.toFixed(2).replace(/\.?0+$/, "") || n.toFixed(2);
    if (n > 0) return n.toFixed(4);
    return "0";
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setUpdatedTime() {
    setText("stats-updated", "Updated " + new Date().toLocaleTimeString());
  }

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("API error");
      return r.json();
    });
  }

  function rpcCall(data) {
    return fetch(ETC_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [data, "latest"],
        id: 1
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.error) throw new Error(json.error.message || "RPC error");
        return json.result;
      });
  }

  function decodeReserves(hex) {
    if (!hex || hex === "0x") return null;
    var raw = hex.slice(2);
    if (raw.length < 192) return null;
    var r0 = raw.slice(0, 64);
    var r1 = raw.slice(64, 128);
    return [
      BigInt("0x" + r0).toString(),
      BigInt("0x" + r1).toString()
    ];
  }

  function decodeAddress(hex) {
    if (!hex || hex === "0x") return null;
    var raw = hex.slice(2);
    if (raw.length < 64) return null;
    return ("0x" + raw.slice(-40)).toLowerCase();
  }

  function renderPie(slices) {
    var total = 0;
    for (var i = 0; i < slices.length; i++) total += Number(slices[i].value);
    if (total <= 0) return;
    var svg = document.getElementById("pupu-pie");
    var legend = document.getElementById("pupu-pie-legend");
    if (!svg || !legend) return;
    var cx = 50, cy = 50, r = 42;
    var start = -90;
    var path = [];
    for (var j = 0; j < slices.length; j++) {
      var pct = (Number(slices[j].value) / total) * 100;
      if (pct <= 0) continue;
      var angle = (pct / 100) * 360;
      var a0 = (start * Math.PI) / 180;
      var a1 = ((start + angle) * Math.PI) / 180;
      var x0 = cx + r * Math.cos(a0);
      var y0 = cy + r * Math.sin(a0);
      var x1 = cx + r * Math.cos(a1);
      var y1 = cy + r * Math.sin(a1);
      var large = angle > 180 ? 1 : 0;
      path.push("<path fill=\"" + slices[j].color + "\" d=\"M " + cx + " " + cy + " L " + x0 + " " + y0 + " A " + r + " " + r + " 0 " + large + " 1 " + x1 + " " + y1 + " Z\" />");
      start += angle;
    }
    svg.innerHTML = path.join("");
    legend.innerHTML = "";
    for (var k = 0; k < slices.length; k++) {
      var pct = ((Number(slices[k].value) / total) * 100).toFixed(1);
      if (Number(slices[k].value) <= 0) continue;
      var li = document.createElement("li");
      li.innerHTML = "<span class=\"pie-legend-dot\" style=\"background:" + slices[k].color + "\"></span><span class=\"pie-legend-label\">" + slices[k].label + "</span><span class=\"pie-legend-pct\">" + pct + "%</span>";
      legend.appendChild(li);
    }
  }

  function loadStats() {
    setText("pool-liquidity", "…");
    setText("etc-burned", "…");
    setText("tokens-burned", "…");
    setText("lp-burned-pct", "…");
    setText("token-holders", "…");
    setText("lp-holders", "…");
    setText("pupu-dead", "…");

    var tokenPromise = fetchJson(BLOCKSCOUT + "/tokens/" + TOKEN_ADDRESS);
    var lpPromise = fetchJson(BLOCKSCOUT + "/tokens/" + LP_ADDRESS);
    var deadBalancesPromise = fetchJson(BLOCKSCOUT + "/addresses/" + DEAD_ADDRESS + "/token-balances");
    var stakeBalancesPromise = fetchJson(BLOCKSCOUT + "/addresses/" + STAKE_CONTRACT + "/token-balances");
    var multisigBalancesPromise = fetchJson(BLOCKSCOUT + "/addresses/" + MULTISIG_ADDRESS + "/token-balances");

    var pairCalls = [
      rpcCall({ to: LP_ADDRESS, data: "0x0902f1ac" }),
      rpcCall({ to: LP_ADDRESS, data: "0x0dfe1681" }),
      rpcCall({ to: LP_ADDRESS, data: "0xd21220a7" })
    ];

    Promise.all([
      Promise.all([tokenPromise, lpPromise, deadBalancesPromise, stakeBalancesPromise, multisigBalancesPromise]),
      Promise.all(pairCalls)
    ])
      .then(function (results) {
        var blockscout = results[0];
        var token = blockscout[0];
        var lp = blockscout[1];
        var deadBalances = blockscout[2];
        var stakeBalances = blockscout[3];
        var multisigBalances = blockscout[4];

        var reservesHex = results[1][0];
        var token0Hex = results[1][1];
        var token1Hex = results[1][2];

        var tokenHolders = token.holders_count != null ? Number(token.holders_count) : null;
        var lpHolders = lp.holders_count != null ? Number(lp.holders_count) : null;
        var lpTotalSupplyRaw = lp.total_supply ? String(lp.total_supply) : null;

        var lpBurnedRaw = null;
        var pupuInDeadRaw = null;
        var lpContractLower = LP_ADDRESS.toLowerCase();
        var tokenContractLower = TOKEN_ADDRESS.toLowerCase();
        if (Array.isArray(deadBalances)) {
          for (var i = 0; i < deadBalances.length; i++) {
            var item = deadBalances[i];
            var addr = (item.token && item.token.address_hash) ? item.token.address_hash.toLowerCase() : "";
            if (addr === lpContractLower && item.value != null) {
              lpBurnedRaw = item.value;
            }
            if (addr === tokenContractLower && item.value != null) {
              pupuInDeadRaw = item.value;
            }
          }
        }
        var stakePUPURaw = null;
        if (Array.isArray(stakeBalances)) {
          for (var s = 0; s < stakeBalances.length; s++) {
            var sItem = stakeBalances[s];
            var sAddr = (sItem.token && sItem.token.address_hash) ? sItem.token.address_hash.toLowerCase() : "";
            if (sAddr === tokenContractLower && sItem.value != null) {
              stakePUPURaw = sItem.value;
              break;
            }
          }
        }
        var multisigPUPURaw = null;
        if (Array.isArray(multisigBalances)) {
          for (var m = 0; m < multisigBalances.length; m++) {
            var mItem = multisigBalances[m];
            var mAddr = (mItem.token && mItem.token.address_hash) ? mItem.token.address_hash.toLowerCase() : "";
            if (mAddr === tokenContractLower && mItem.value != null) {
              multisigPUPURaw = mItem.value;
              break;
            }
          }
        }

        setText("token-holders", tokenHolders != null ? tokenHolders.toLocaleString() : "—");
        setText("lp-holders", lpHolders != null ? lpHolders.toLocaleString() : "—");

        if (pupuInDeadRaw != null) {
          setText("pupu-dead", formatCompact(pupuInDeadRaw, 18));
        } else {
          setText("pupu-dead", "0");
        }

        var reserves = decodeReserves(reservesHex);
        var token0 = decodeAddress(token0Hex);
        var token1 = decodeAddress(token1Hex);

        var reservePUPU = null;
        var reserveETC = null;
        if (reserves && token0 !== null && token1 !== null) {
          var pupuLower = TOKEN_ADDRESS.toLowerCase();
          var wetcLower = WETC_ADDRESS.toLowerCase();
          if (token0 === pupuLower && token1 === wetcLower) {
            reservePUPU = reserves[0];
            reserveETC = reserves[1];
          } else if (token0 === wetcLower && token1 === pupuLower) {
            reserveETC = reserves[0];
            reservePUPU = reserves[1];
          }
        }

        if (reservePUPU != null && reserveETC != null) {
          setText(
            "pool-liquidity",
            formatCompact(reservePUPU, 18) + " PUPU  /  " + formatCompact(reserveETC, 18) + " ETC"
          );
        } else {
          setText("pool-liquidity", "—");
        }

        if (lpBurnedRaw != null) {
          if (lpTotalSupplyRaw && Number(lpTotalSupplyRaw) > 0) {
            var pct = (Number(lpBurnedRaw) / Number(lpTotalSupplyRaw)) * 100;
            setText("lp-burned-pct", pct.toFixed(1) + "%");
            if (reserveETC != null) {
              try {
                var etcBurnedWei = (BigInt(lpBurnedRaw) * BigInt(reserveETC)) / BigInt(lpTotalSupplyRaw);
                setText("etc-burned", formatCompact(etcBurnedWei.toString(), 18));
              } catch (e) {
                setText("etc-burned", "—");
              }
            } else {
              setText("etc-burned", "—");
            }
            if (reservePUPU != null) {
              try {
                var tokensBurnedWei = (BigInt(lpBurnedRaw) * BigInt(reservePUPU)) / BigInt(lpTotalSupplyRaw);
                setText("tokens-burned", formatCompact(tokensBurnedWei.toString(), 18));
              } catch (e) {
                setText("tokens-burned", "—");
              }
            } else {
              setText("tokens-burned", "—");
            }
          } else {
            setText("lp-burned-pct", "—");
            setText("etc-burned", "—");
            setText("tokens-burned", "—");
          }
        } else {
          setText("lp-burned-pct", "0%");
          setText("etc-burned", "0");
          setText("tokens-burned", "0");
        }

        var totalSupplyRaw = token.total_supply ? String(token.total_supply) : null;
        if (totalSupplyRaw) {
          var deadVal = pupuInDeadRaw != null ? BigInt(pupuInDeadRaw) : BigInt(0);
          var lpVal = reservePUPU != null ? BigInt(reservePUPU) : BigInt(0);
          var stakeVal = stakePUPURaw != null ? BigInt(stakePUPURaw) : BigInt(0);
          var multiVal = multisigPUPURaw != null ? BigInt(multisigPUPURaw) : BigInt(0);
          var totalVal = BigInt(totalSupplyRaw);
          var otherVal = totalVal - deadVal - lpVal - stakeVal - multiVal;
          if (otherVal < 0) otherVal = BigInt(0);
          var pieSlices = [
            { value: multiVal.toString(), label: "Multisig", color: "#c9a227" },
            { value: otherVal.toString(), label: "Holders", color: "#e5c65c" },
            { value: deadVal.toString(), label: "Dead wallet", color: "#5a4a3a" },
            { value: lpVal.toString(), label: "LP pool", color: "#8b7320" },
            { value: stakeVal.toString(), label: "NFT stake", color: "#2d3d2d" }
          ];
          renderPie(pieSlices);
        }

        setUpdatedTime();
      })
      .catch(function (err) {
        setText("pool-liquidity", "—");
        setText("etc-burned", "—");
        setText("tokens-burned", "—");
        setText("lp-burned-pct", "—");
        setText("token-holders", "—");
        setText("lp-holders", "—");
        setText("pupu-dead", "—");
        setText("stats-updated", "Update failed. Try again.");
      });
  }

  var refreshBtn = document.getElementById("refresh-stats");
  if (refreshBtn) refreshBtn.addEventListener("click", loadStats);
  loadStats();
})();
