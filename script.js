// Smooth scroll for anchor links (fallback for older browsers)
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (!href || href === "#") return;

    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// Copy contract address to clipboard (supports multiple buttons via data-copy)
document.querySelectorAll(".contract-copy[data-copy]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var id = this.getAttribute("data-copy");
    var code = document.getElementById(id);
    if (!code) return;
    var text = code.textContent.trim();
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(function () {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 2000);
    });
  });
});

// Homepage live token stats.
(function () {
  var multisigEl = document.getElementById("home-multisig-pupu");
  var lpEl = document.getElementById("home-lp-pupu");
  var burnedEl = document.getElementById("home-lp-burned-pct");
  if (!multisigEl || !lpEl || !burnedEl) return;

  var BLOCKSCOUT = "https://etc.blockscout.com/api/v2";
  var ETC_RPC = "https://etc.blockscout.com/api/eth-rpc";
  var TOKEN_ADDRESS = "0x0bD01d2C68f89AbeD94BC85988fa8A6e18EFb2db";
  var LP_ADDRESS = "0x9f1a8fC0ef058F3001c1628D8130d1C5301201C9";
  var DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
  var WETC_ADDRESS = "0x82a618305706b14e7bcf2592d4b9324a366b6dad";
  var MULTISIG_ADDRESS = "0xE1a12E10b3E0584929f3cF21A71b8DD0fCf6cB76";

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("API error");
      return response.json();
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
      .then(function (response) { return response.json(); })
      .then(function (json) {
        if (json.error) throw new Error(json.error.message || "RPC error");
        return json.result;
      });
  }

  function decodeAddress(hex) {
    if (!hex || hex === "0x") return null;
    var raw = hex.slice(2);
    if (raw.length < 64) return null;
    return ("0x" + raw.slice(-40)).toLowerCase();
  }

  function decodeReserves(hex) {
    if (!hex || hex === "0x") return null;
    var raw = hex.slice(2);
    if (raw.length < 192) return null;
    return [
      BigInt("0x" + raw.slice(0, 64)).toString(),
      BigInt("0x" + raw.slice(64, 128)).toString()
    ];
  }

  function formatCompact(raw) {
    if (raw === null || raw === undefined) return null;
    var decimals = 18;
    var str = String(raw);
    var value = str.length <= decimals ? 0 : Number(str.slice(0, -decimals) + "." + str.slice(-decimals));
    if (!isFinite(value)) return null;
    if (value >= 1e9) return (value / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
    if (value >= 1e6) return (value / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (value >= 1e3) return (value / 1e3).toFixed(2).replace(/\.?0+$/, "") + "K";
    return value.toFixed(2).replace(/\.?0+$/, "");
  }

  function findTokenBalance(balances, tokenAddress) {
    if (!Array.isArray(balances)) return null;
    var target = tokenAddress.toLowerCase();
    for (var i = 0; i < balances.length; i++) {
      var item = balances[i];
      var address = item.token && item.token.address_hash ? item.token.address_hash.toLowerCase() : "";
      if (address === target && item.value != null) return item.value;
    }
    return null;
  }

  Promise.all([
    fetchJson(BLOCKSCOUT + "/tokens/" + LP_ADDRESS),
    fetchJson(BLOCKSCOUT + "/addresses/" + DEAD_ADDRESS + "/token-balances"),
    fetchJson(BLOCKSCOUT + "/addresses/" + MULTISIG_ADDRESS + "/token-balances"),
    rpcCall({ to: LP_ADDRESS, data: "0x0902f1ac" }),
    rpcCall({ to: LP_ADDRESS, data: "0x0dfe1681" }),
    rpcCall({ to: LP_ADDRESS, data: "0xd21220a7" })
  ])
    .then(function (results) {
      var lp = results[0];
      var deadBalances = results[1];
      var multisigBalances = results[2];
      var reserves = decodeReserves(results[3]);
      var token0 = decodeAddress(results[4]);
      var token1 = decodeAddress(results[5]);
      var lpTotalSupplyRaw = lp.total_supply ? String(lp.total_supply) : null;

      var multisigRaw = findTokenBalance(multisigBalances, TOKEN_ADDRESS);
      var lpBurnedRaw = findTokenBalance(deadBalances, LP_ADDRESS);
      var reservePUPU = null;

      if (reserves && token0 !== null && token1 !== null) {
        var pupuLower = TOKEN_ADDRESS.toLowerCase();
        var wetcLower = WETC_ADDRESS.toLowerCase();
        if (token0 === pupuLower && token1 === wetcLower) {
          reservePUPU = reserves[0];
        } else if (token0 === wetcLower && token1 === pupuLower) {
          reservePUPU = reserves[1];
        }
      }

      var multisigFormatted = formatCompact(multisigRaw);
      var lpFormatted = formatCompact(reservePUPU);
      if (multisigFormatted) multisigEl.textContent = multisigFormatted;
      if (lpFormatted) lpEl.textContent = lpFormatted;

      if (lpBurnedRaw != null && lpTotalSupplyRaw && Number(lpTotalSupplyRaw) > 0) {
        burnedEl.textContent = ((Number(lpBurnedRaw) / Number(lpTotalSupplyRaw)) * 100).toFixed(1) + "%";
      }
    })
    .catch(function () {
      // Keep the static fallback values when external chain data is unavailable.
    });
})();
