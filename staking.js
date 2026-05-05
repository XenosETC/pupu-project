var navToggle = document.querySelector(".nav-toggle");
var primaryNav = document.getElementById("primary-nav");
if (navToggle && primaryNav) {
  navToggle.addEventListener("click", function () {
    var expanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!expanded));
    navToggle.setAttribute("aria-label", expanded ? "Open navigation" : "Close navigation");
    primaryNav.classList.toggle("is-open", !expanded);
  });

  primaryNav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Open navigation");
      primaryNav.classList.remove("is-open");
    });
  });
}

document.querySelectorAll(".contract-copy[data-copy]").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var id = this.getAttribute("data-copy");
    var code = document.getElementById(id);
    if (!code) return;
    navigator.clipboard.writeText(code.textContent.trim()).then(function () {
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(function () {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 2000);
    });
  });
});

(function () {
  var BLOCKSCOUT = "https://etc.blockscout.com/api/v2";
  var ETC_RPC = "https://etc.blockscout.com/api/eth-rpc";
  var TOKEN_ADDRESS = "0x0bD01d2C68f89AbeD94BC85988fa8A6e18EFb2db";
  var LP_ADDRESS = "0x9f1a8fC0ef058F3001c1628D8130d1C5301201C9";
  var DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
  var WETC_ADDRESS = "0x82a618305706b14e7bcf2592d4b9324a366b6dad";
  var STAKE_CONTRACT = "0x547F1eE3eCe50c0F5cc998D24E9FF28793b42Ee5";
  var pageType = document.body.getAttribute("data-staking-page");

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

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
    if (raw === null || raw === undefined) return "-";
    var decimals = 18;
    var str = String(raw);
    var value = str.length <= decimals ? 0 : Number(str.slice(0, -decimals) + "." + str.slice(-decimals));
    if (!isFinite(value)) return "-";
    if (value >= 1e9) return (value / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
    if (value >= 1e6) return (value / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (value >= 1e3) return (value / 1e3).toFixed(2).replace(/\.?0+$/, "") + "K";
    if (value > 0) return value.toFixed(4).replace(/\.?0+$/, "");
    return "0";
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

  function loadLpStats() {
    return Promise.all([
      fetchJson(BLOCKSCOUT + "/tokens/" + LP_ADDRESS),
      fetchJson(BLOCKSCOUT + "/addresses/" + DEAD_ADDRESS + "/token-balances"),
      rpcCall({ to: LP_ADDRESS, data: "0x0902f1ac" }),
      rpcCall({ to: LP_ADDRESS, data: "0x0dfe1681" }),
      rpcCall({ to: LP_ADDRESS, data: "0xd21220a7" })
    ]).then(function (results) {
      var lp = results[0];
      var deadBalances = results[1];
      var reserves = decodeReserves(results[2]);
      var token0 = decodeAddress(results[3]);
      var token1 = decodeAddress(results[4]);
      var reservePUPU = null;
      var reserveETC = null;

      if (reserves && token0 && token1) {
        var pupuLower = TOKEN_ADDRESS.toLowerCase();
        var wetcLower = WETC_ADDRESS.toLowerCase();
        if (token0 === pupuLower && token1 === wetcLower) {
          reservePUPU = reserves[0];
          reserveETC = reserves[1];
        } else if (token0 === wetcLower && token1 === pupuLower) {
          reservePUPU = reserves[1];
          reserveETC = reserves[0];
        }
      }

      setText("stake-pool-pupu", formatCompact(reservePUPU));
      setText("stake-pool-etc", formatCompact(reserveETC));
      setText("hero-pool-pupu", formatCompact(reservePUPU));

      var lpBurnedRaw = findTokenBalance(deadBalances, LP_ADDRESS);
      if (lpBurnedRaw != null && lp.total_supply && Number(lp.total_supply) > 0) {
        var burnedPct = ((Number(lpBurnedRaw) / Number(lp.total_supply)) * 100).toFixed(1) + "%";
        setText("stake-lp-burned", burnedPct);
        setText("hero-lp-burned", burnedPct);
      }
    });
  }

  function loadTokenStats() {
    return Promise.all([
      fetchJson(BLOCKSCOUT + "/tokens/" + TOKEN_ADDRESS),
      fetchJson(BLOCKSCOUT + "/addresses/" + STAKE_CONTRACT + "/token-balances")
    ]).then(function (results) {
      var token = results[0];
      var balances = results[1];
      var stakedRaw = findTokenBalance(balances, TOKEN_ADDRESS);
      setText("stake-token-balance", formatCompact(stakedRaw));
      setText("hero-token-staked", formatCompact(stakedRaw));
      setText("stake-token-holders", token.holders_count != null ? Number(token.holders_count).toLocaleString() : "-");
      setText("stake-token-supply", token.total_supply ? formatCompact(token.total_supply) : "-");
    });
  }

  if (pageType === "lp") {
    loadLpStats().catch(function () {});
  } else if (pageType === "token") {
    loadTokenStats().catch(function () {});
  } else if (pageType === "combined") {
    loadLpStats().catch(function () {});
    loadTokenStats().catch(function () {});
  }
})();

(function () {
  var connectBtn = document.getElementById("connect-wallet");
  var walletStatus = document.getElementById("wallet-status");
  var networkStatus = document.getElementById("network-status");
  if (!connectBtn || !walletStatus || !networkStatus) return;

  function shortAddress(address) {
    return address.slice(0, 6) + "..." + address.slice(-4);
  }

  connectBtn.addEventListener("click", function () {
    if (!window.ethereum || !window.ethereum.request) {
      walletStatus.textContent = "No wallet found";
      networkStatus.textContent = "Install ETC-capable wallet";
      return;
    }

    window.ethereum.request({ method: "eth_requestAccounts" })
      .then(function (accounts) {
        walletStatus.textContent = accounts && accounts[0] ? shortAddress(accounts[0]) : "No account";
        return window.ethereum.request({ method: "eth_chainId" });
      })
      .then(function (chainId) {
        networkStatus.textContent = chainId === "0x3d" ? "Ethereum Classic" : "Switch to ETC";
      })
      .catch(function () {
        walletStatus.textContent = "Wallet not connected";
      });
  });
})();
