let DATA = null;
let selections = JSON.parse(localStorage.getItem("mastercat_dubbi_selections") || "{}");

let pageOpere = 1;
let pageMasters = 1;
const PAGE_SIZE = 100;

async function init() {
  const resp = await fetch("data.json");
  DATA = await resp.json();
  renderOverview();
  renderOpere();
  renderMasters();
  renderReleases();
  renderDubbi();
  updateDubbiKpi();
  bindEvents();
}

function renderBars(containerId, items, total) {
  const el = document.getElementById(containerId);
  el.innerHTML = items.map(it => {
    const pct = ((it.val / total) * 100).toFixed(1);
    return `
      <div class="bar-row">
        <div class="bar-label">
          <span>${it.label}</span>
          <strong>${it.val} (${pct}%)</strong>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%; background:${it.color || 'var(--accent)'}"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderOverview() {
  renderBars("chart-shares", [
    { label: "Quota DEM = 50,00% (Editore Unico Big Maff)", val: 101, color: "#10b981" },
    { label: "Quota DEM = 33,33%", val: 20, color: "#34d399" },
    { label: "Quota DEM = 25,00% (Co-edizione 50%, es. con Cramps)", val: 363, color: "#3b82f6" },
    { label: "Quota DEM = 12,50% – 20,84%", val: 192, color: "#60a5fa" },
    { label: "Quota DEM = 8,33% (Co-edizione 1/6)", val: 267, color: "#8b5cf6" },
    { label: "Altre quote frazionarie (< 8,33%)", val: 116, color: "#94a3b8" }
  ], 1059);

  renderBars("chart-matching", [
    { label: "Livello 1: Titolo Esatto + Cognome Autore (98%)", val: 716, color: "#10b981" },
    { label: "Livello 2: Titolo Base / Pool Band / Durata (85-92%)", val: 62, color: "#3b82f6" },
    { label: "Livello 3 & 4: Match Omonimo o Fuzzy Da Revisionare", val: 29, color: "#f59e0b" },
    { label: "Nessun Match in SIAE Big Maff (D.R. / Terzi / Da dep.)", val: 276, color: "#ef4444" }
  ], 1083);

  renderBars("chart-copubs", [
    { label: "CRAMPS MUSIC S.R.L.", val: 566, color: "#3b82f6" },
    { label: "SONY MUSIC PUBLISHING (ITALY)", val: 61, color: "#60a5fa" },
    { label: "LA TEMPESTA", val: 42, color: "#10b981" },
    { label: "TUTTOMOLTOBENEGRAZIE SRL", val: 41, color: "#34d399" },
    { label: "PANICO CONCERTI SRLS", val: 34, color: "#f59e0b" },
    { label: "TOTALLY IMPORTED / VENTIDICIOTTO / SUGARMUSIC", val: 72, color: "#8b5cf6" }
  ], 1059);

  renderBars("chart-health", [
    { label: "Opere SIAE in stato 'Regolare'", val: 1051, color: "#10b981" },
    { label: "Opere SIAE con codice ISWC assegnato", val: 808, color: "#3b82f6" },
    { label: "Opere SIAE con co-autori 'Non Iscritto / Non Amministrato'", val: 214, color: "#f59e0b" },
    { label: "Opere SIAE in stato 'Irregolare' (Estromissione / Doppione)", val: 8, color: "#ef4444" }
  ], 1059);
}

function playSpotify(trackId) {
  if (!trackId) return;
  const drawer = document.getElementById("spotify-drawer");
  const iframe = document.getElementById("spotify-iframe");
  iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
  drawer.classList.remove("hidden");
}

window.playSpotify = playSpotify;

function getFilteredOpere() {
  const q = (document.getElementById("search-opere").value || "").toLowerCase().trim();
  const fq = document.getElementById("filter-opere-quota").value;
  const fm = document.getElementById("filter-opere-match").value;

  return DATA.opere.filter(o => {
    if (q) {
      const hay = `${o.cod} ${o.iswc} ${o.titolo} ${o.alt} ${o.authors} ${o.co_pubs} ${o.artist} ${o.isrcs.join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fq === "50" && Math.abs(o.bm_dem - 50) > 0.1) return false;
    if (fq === "33" && Math.abs(o.bm_dem - 33.33) > 0.5) return false;
    if (fq === "25" && Math.abs(o.bm_dem - 25) > 0.1) return false;
    if (fq === "12_21" && (o.bm_dem < 12.4 || o.bm_dem > 21.0)) return false;
    if (fq === "8.33" && Math.abs(o.bm_dem - 8.33) > 0.1) return false;
    if (fq === "NON_ISC" && o.non_isc <= 0) return false;

    if (fm === "LINKED" && o.isrcs.length === 0) return false;
    if (fm === "EXTRA_SP" && !(o.isrcs.length === 0 && o.sp_url)) return false;
    if (fm === "ONLY_SIAE" && (o.isrcs.length > 0 || o.sp_url)) return false;
    if (fm === "IRREG" && o.stato === "Regolare") return false;
    return true;
  });
}

function renderOpere() {
  const list = getFilteredOpere();
  document.getElementById("count-opere").textContent = `${list.length} opere trovate`;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (pageOpere > totalPages) pageOpere = 1;
  const slice = list.slice((pageOpere - 1) * PAGE_SIZE, pageOpere * PAGE_SIZE);
  document.getElementById("page-opere").textContent = `Pagina ${pageOpere} di ${totalPages}`;

  const tbody = document.getElementById("tbody-opere");
  tbody.innerHTML = slice.map(o => {
    const badgeClass = o.bm_dem >= 50 ? "b-green" : (o.bm_dem >= 25 ? "b-blue" : "b-amber");
    const statoBadge = o.stato !== "Regolare" ? `<span class="badge b-red">${o.stato}</span>` : "";
    const spHtml = o.sp_id
      ? `<button class="btn" style="padding:4px 8px;font-size:0.78rem;" onclick="playSpotify('${o.sp_id}')">▶ Play</button> <a href="${o.sp_url}" target="_blank" class="sp-link">Spotify ↗</a>`
      : (o.sp_url ? `<a href="${o.sp_url}" target="_blank" class="sp-link">Spotify (Terzi) ↗</a>` : `<span style="color:var(--muted)">—</span>`);
    return `
      <tr>
        <td class="mono">${o.cod} ${statoBadge}</td>
        <td class="mono">${o.iswc || '<span style="color:var(--muted)">—</span>'}</td>
        <td><strong>${o.titolo}</strong>${o.alt ? `<br><small style="color:var(--muted)">Alt: ${o.alt}</small>` : ''}</td>
        <td>
          <span class="badge ${badgeClass}">DEM: ${o.bm_dem.toFixed(2)}%</span>
          <span class="badge b-blue">DRM: ${o.bm_drm.toFixed(2)}%</span>
          ${o.non_isc > 0 ? `<br><small style="color:var(--amber)">Non iscr.: ${o.non_isc.toFixed(2)}%</small>` : ''}
        </td>
        <td><small>${o.co_pubs}</small></td>
        <td><small>${o.authors}</small></td>
        <td>
          ${o.artist ? `<strong>${o.artist}</strong><br>` : ''}
          <span class="mono" style="color:var(--muted)">${o.isrcs.join(", ") || "Nessun Master Believe"}</span>
        </td>
        <td>${spHtml}</td>
      </tr>
    `;
  }).join("");
}

function getFilteredMasters() {
  const q = (document.getElementById("search-masters").value || "").toLowerCase().trim();
  const fm = document.getElementById("filter-masters-match").value;
  const fs = document.getElementById("filter-masters-sp").value;

  return DATA.masters.filter(m => {
    if (q) {
      const hay = `${m.isrc} ${m.title} ${m.artist} ${m.author_bel} ${m.comp_bel} ${m.cod_opera} ${m.rel_title}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fm === "MATCHED" && !m.cod_opera) return false;
    if (fm === "REVIEW" && m.match_status !== "DA REVISIONARE") return false;
    if (fm === "UNMATCHED" && m.cod_opera) return false;

    if (fs !== "ALL" && m.sp_method !== fs) return false;
    return true;
  });
}

function renderMasters() {
  const list = getFilteredMasters();
  document.getElementById("count-masters").textContent = `${list.length} master trovati`;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (pageMasters > totalPages) pageMasters = 1;
  const slice = list.slice((pageMasters - 1) * PAGE_SIZE, pageMasters * PAGE_SIZE);
  document.getElementById("page-masters").textContent = `Pagina ${pageMasters} di ${totalPages}`;

  const tbody = document.getElementById("tbody-masters");
  tbody.innerHTML = slice.map(m => {
    const matchHtml = m.cod_opera
      ? `<span class="badge ${m.match_status === 'DA REVISIONARE' ? 'b-amber' : 'b-green'}">${m.cod_opera}</span><br><small style="color:var(--muted)">${m.match_method}</small>`
      : `<span class="badge b-red">Assente in SIAE Big Maff</span>`;
    const quotaHtml = m.cod_opera
      ? `<span class="badge b-green">DEM ${m.bm_dem.toFixed(2)}%</span><br><small style="color:var(--muted)">${m.siae_pubs}</small>`
      : `<span style="color:var(--muted)">0% (Ed. Believe: ${m.ed_bel || 'Vuoto'})</span>`;
    const spHtml = m.sp_found
      ? `<button class="btn" style="padding:4px 8px;font-size:0.78rem;" onclick="playSpotify('${m.sp_id}')">▶ Play</button> <a href="${m.sp_url}" target="_blank" class="sp-link">Pop: ${m.sp_pop} ↗</a>`
      : `<span class="badge b-red">Non trovato IT</span>`;
    return `
      <tr>
        <td class="mono">${m.isrc}</td>
        <td><strong>${m.title}</strong>${m.ver ? ` <small style="color:var(--muted)">(${m.ver})</small>` : ''}</td>
        <td>${m.artist}</td>
        <td class="mono">${m.dur}</td>
        <td><small>${m.label}<br><span style="color:var(--muted)">${m.rel_title} (${m.rel_date})</span></small></td>
        <td>${matchHtml}</td>
        <td>${quotaHtml}</td>
        <td>${spHtml}</td>
      </tr>
    `;
  }).join("");
}

function renderReleases() {
  const q = (document.getElementById("search-releases").value || "").toLowerCase().trim();
  const list = DATA.releases.filter(r => {
    if (!q) return true;
    return `${r.upc} ${r.title} ${r.artist} ${r.label}`.toLowerCase().includes(q);
  });
  document.getElementById("count-releases").textContent = `${list.length} release trovate`;
  document.getElementById("tbody-releases").innerHTML = list.map(r => `
    <tr>
      <td class="mono">${r.upc}</td>
      <td class="mono">${r.date}</td>
      <td><strong>${r.artist}</strong></td>
      <td>${r.title}${r.ver ? ` <small style="color:var(--muted)">(${r.ver})</small>` : ''}</td>
      <td>${r.label}</td>
      <td>${r.genre}</td>
      <td class="mono">${r.tracks}</td>
      <td>${r.sp_album_url ? `<a href="${r.sp_album_url}" target="_blank" class="sp-link">Apri Album Spotify ↗</a>` : '—'}</td>
    </tr>
  `).join("");
}

function toggleDubbio(id, optNum) {
  if (selections[id] === optNum) {
    delete selections[id];
  } else {
    selections[id] = optNum;
  }
  localStorage.setItem("mastercat_dubbi_selections", JSON.stringify(selections));
  updateDubbiKpi();
  renderDubbi();
}
window.toggleDubbio = toggleDubbio;

function updateDubbiKpi() {
  const count = Object.keys(selections).length;
  const el = document.getElementById("kpi-dubbi-resolved");
  if (el && DATA) {
    el.textContent = `${count} / ${DATA.dubbi.length}`;
    el.style.color = count > 0 ? "var(--accent)" : "var(--amber)";
  }
}

function renderDubbi() {
  const q = (document.getElementById("search-dubbi").value || "").toLowerCase().trim();
  const fcat = document.getElementById("filter-dubbi-cat").value;
  const fst = document.getElementById("filter-dubbi-status").value;

  const list = DATA.dubbi.filter(d => {
    if (q) {
      const hay = `${d.id} ${d.cat} ${d.ident} ${d.artist} ${d.q} ${d.opt1} ${d.opt2}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (fcat !== "ALL" && !d.cat.startsWith(fcat)) return false;
    if (fst === "PENDING" && selections[d.id]) return false;
    if (fst === "DECIDED" && !selections[d.id]) return false;
    return true;
  });

  document.getElementById("count-dubbi").textContent = `${list.length} casi mostrati (${Object.keys(selections).length} selezionati in verde)`;
  document.getElementById("tbody-dubbi").innerHTML = list.map(d => {
    const sel = selections[d.id];
    const spHtml = d.sp_id
      ? `<button class="btn" style="padding:4px 8px;font-size:0.78rem;" onclick="playSpotify('${d.sp_id}')">▶ Play</button>`
      : (d.sp_url ? `<a href="${d.sp_url}" target="_blank" class="sp-link">Spotify ↗</a>` : '—');
    return `
      <tr>
        <td>
          <strong class="mono">${d.id}</strong><br>
          <span class="badge b-blue" style="margin-top:4px;">${d.cat}</span>
        </td>
        <td>
          <strong>${d.artist}</strong><br>
          <span class="mono" style="color:var(--muted)">${d.ident}</span>
        </td>
        <td><small>${d.q}</small></td>
        <td>
          <div class="opt-cell ${sel === 1 ? 'selected-green' : ''}" onclick="toggleDubbio('${d.id}', 1)">
            ${sel === 1 ? '✅ ' : '⬜ '} ${d.opt1}
          </div>
        </td>
        <td>
          <div class="opt-cell ${sel === 2 ? 'selected-green' : ''}" onclick="toggleDubbio('${d.id}', 2)">
            ${sel === 2 ? '✅ ' : '⬜ '} ${d.opt2}
          </div>
        </td>
        <td>${spHtml}</td>
      </tr>
    `;
  }).join("");
}

function exportDubbiCsv() {
  const rows = [["ID_Dubbio", "Categoria", "Identificativo", "Artista", "Opzione_Scelta_Numero", "Testo_Opzione_Scelta"]];
  DATA.dubbi.forEach(d => {
    const s = selections[d.id];
    if (s) {
      rows.push([
        d.id,
        d.cat,
        d.ident,
        d.artist,
        s === 1 ? "OPZIONE_1" : "OPZIONE_2",
        s === 1 ? d.opt1 : d.opt2
      ]);
    }
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scelte_revisione_dubbi_dischi_sotterranei.csv";
  a.click();
}

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.getAttribute("data-tab");
      ["overview", "opere", "masters", "releases", "dubbi"].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle("hidden", t !== target);
      });
    });
  });

  ["search-opere", "filter-opere-quota", "filter-opere-match"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => { pageOpere = 1; renderOpere(); });
  });
  document.getElementById("prev-opere").addEventListener("click", () => { if (pageOpere > 1) { pageOpere--; renderOpere(); } });
  document.getElementById("next-opere").addEventListener("click", () => { pageOpere++; renderOpere(); });

  ["search-masters", "filter-masters-match", "filter-masters-sp"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => { pageMasters = 1; renderMasters(); });
  });
  document.getElementById("prev-masters").addEventListener("click", () => { if (pageMasters > 1) { pageMasters--; renderMasters(); } });
  document.getElementById("next-masters").addEventListener("click", () => { pageMasters++; renderMasters(); });

  document.getElementById("search-releases").addEventListener("input", renderReleases);
  ["search-dubbi", "filter-dubbi-cat", "filter-dubbi-status"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderDubbi);
  });

  document.getElementById("btn-export-dubbi").addEventListener("click", exportDubbiCsv);
  document.getElementById("close-player").addEventListener("click", () => {
    document.getElementById("spotify-drawer").classList.add("hidden");
    document.getElementById("spotify-iframe").src = "";
  });
}

init();
