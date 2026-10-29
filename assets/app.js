(() => {
  "use strict";

  const config = window.DOWNLOAD_CONFIG || {};
  const repository = String(config.repository || "").trim();
  const assetName = String(config.assetName || "").trim();
  const productName = String(config.productName || "Download Portal").trim();
  const description = String(config.description || "").trim();
  const repoIsConfigured = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
    && !repository.includes("JustinKirchmann")
    && !repository.includes("Mechanica");
  const repoUrl = repoIsConfigured ? `https://github.com/${repository}` : "https://github.com";
  const assetUrl = repoIsConfigured && assetName
    ? `${repoUrl}/releases/latest/download/${encodeURIComponent(assetName)}`
    : "#versions";

  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };

  ["brand-name", "footer-name"].forEach((id) => setText(id, productName));
  document.title = `${productName} — Downloads`;
  ["repository-link", "footer-releases"].forEach((id) => {
    const node = $(id);
    if (node) node.href = repoIsConfigured ? `${repoUrl}/releases` : "https://github.com";
  });

  const latestButton = $("latest-download");
  if (latestButton) latestButton.href = assetUrl;

  function humanSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "Größe unbekannt";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return `${value.toLocaleString("de-AT", { maximumFractionDigits: 1 })} ${units[unit]}`;
  }

  function humanDate(value) {
    if (!value) return "Datum unbekannt";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Datum unbekannt";
    return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function makeVersionRow(release, asset, index) {
    const row = document.createElement("article");
    row.className = "version-row";

    const indexNode = document.createElement("span");
    indexNode.className = "version-index";
    indexNode.textContent = String(index + 1).padStart(2, "0");
    indexNode.setAttribute("aria-hidden", "true");

    const main = document.createElement("div");
    main.className = "version-main";
    const titleLine = document.createElement("div");
    titleLine.className = "version-title-line";
    const title = document.createElement("h3");
    title.textContent = release.name || release.tag_name || "Unbenannte Version";
    const tag = document.createElement("span");
    tag.className = "version-pill subtle";
    tag.textContent = release.tag_name || "ohne Tag";
    titleLine.append(title, tag);
    const meta = document.createElement("p");
    meta.className = "version-meta";
    meta.textContent = `${humanDate(release.published_at || release.created_at)} · ${humanSize(asset.size)} · ${asset.download_count.toLocaleString("de-AT")} Downloads`;
    main.append(titleLine, meta);

    const download = document.createElement("a");
    download.className = "icon-button";
    download.href = asset.browser_download_url;
    download.setAttribute("aria-label", `${release.tag_name || "Version"} herunterladen`);
    download.title = "Diese Version herunterladen";
    download.innerHTML = '<span aria-hidden="true">↓</span>';

    row.append(indexNode, main, download);
    return row;
  }

  function showNoReleases(message) {
    setText("latest-name", "Noch keine Version veröffentlicht");
    setText("latest-version", "—");
    setText("latest-description", message);
    setText("latest-date", "Warte auf den ersten Release");
    setText("latest-size", "Dateigröße —");
    setText("art-version", "—");
    if (latestButton) {
      latestButton.href = repoIsConfigured ? `${repoUrl}/releases` : "#versions";
      latestButton.removeAttribute("aria-disabled");
      latestButton.innerHTML = '<span>Releases ansehen</span><span class="download-arrow" aria-hidden="true">↗</span>';
    }
    const list = $("version-list");
    list.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const symbol = document.createElement("span");
    symbol.className = "empty-symbol";
    symbol.textContent = "↗";
    const text = document.createElement("p");
    text.textContent = repoIsConfigured
      ? "Sobald du den ersten Release mit der konfigurierten Datei veröffentlichst, erscheint er hier."
      : "Trage dein GitHub-Repository in assets/config.js ein, um die Release-Historie zu laden.";
    empty.append(symbol, text);
    list.append(empty);
    setText("history-count", "0 Versionen");
  }

  async function loadReleases() {
    if (!repoIsConfigured || !assetName) {
      showNoReleases("Bitte Repository und Dateiname in assets/config.js konfigurieren.");
      setText("status-message", "Konfiguration fehlt: assets/config.js anpassen.");
      return;
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100`, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!response.ok) throw new Error(`GitHub API antwortet mit ${response.status}`);
      const releases = await response.json();
      const versions = releases
        .filter((release) => !release.draft && !release.prerelease)
        .map((release) => ({ release, asset: (release.assets || []).find((item) => item.name === assetName) }))
        .filter((item) => item.asset)
        .sort((a, b) => new Date(b.release.published_at || b.release.created_at) - new Date(a.release.published_at || a.release.created_at));

      if (!versions.length) {
        showNoReleases("Es wurde noch kein veröffentlichter Release mit der konfigurierten Datei gefunden.");
        setText("status-message", "Noch kein Download verfügbar. Veröffentliche eine Version mit einem v*-Tag.");
        return;
      }

      const current = versions[0];
      setText("latest-name", current.release.name || productName);
      setText("latest-version", current.release.tag_name || "Release");
      setText("latest-description", current.release.body?.trim().split("\n").find((line) => line.trim()) || `Datei: ${assetName}`);
      setText("latest-date", `Veröffentlicht am ${humanDate(current.release.published_at || current.release.created_at)}`);
      setText("latest-size", humanSize(current.asset.size));
      setText("art-version", (current.release.tag_name || "—").replace(/^v/i, ""));
      if (latestButton) {
        latestButton.href = current.asset.browser_download_url;
        latestButton.removeAttribute("aria-disabled");
        latestButton.innerHTML = '<span>Download</span><span class="download-arrow" aria-hidden="true">↓</span>';
      }

      const list = $("version-list");
      list.replaceChildren(...versions.map((item, index) => makeVersionRow(item.release, item.asset, index)));
      setText("history-count", `${versions.length} ${versions.length === 1 ? "Version" : "Versionen"}`);
      setText("status-message", `Datei wird über GitHub bereitgestellt: ${assetName}`);
    } catch (error) {
      showNoReleases("Die Release-Informationen konnten gerade nicht geladen werden.");
      setText("status-message", "GitHub konnte nicht abgefragt werden. Du kannst die Release-Seite direkt öffnen.");
      console.error("Fehler beim Laden der GitHub-Releases:", error);
    }
  }

  loadReleases();
})();
