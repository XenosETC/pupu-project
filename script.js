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
