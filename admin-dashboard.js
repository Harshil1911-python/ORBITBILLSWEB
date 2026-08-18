// =========================================================================
// helpers — data lives in IndexedDB via Db.js (tsLocalApi)
// =========================================================================
function escapeHtml(str){
  if (str === undefined || str === null) return "";
  return String(str).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function money(n){ return "₹" + Number(n || 0).toFixed(2); }
function openModal(id){ const el=document.getElementById(id); if(el) el.classList.add("open"); }
document.getElementById("adminActionSheet")?.addEventListener("click", function(e){ if(e.target === this) closeModal("adminActionSheet"); });
function closeModal(id){ document.getElementById(id).classList.remove("open"); }

async function api(path, options){
  options = options || {};
  if (!tsRequireRole("admin", "billing", "accountant")) {
    return { ok: false, error: "Not signed in." };
  }
  try {
    if (options.body instanceof FormData) {
      const obj = {};
      for (const [k, v] of options.body.entries()) {
        if (v instanceof File) {
          if (v.size) {
            obj[k] = await new Promise((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result);
              r.readAsDataURL(v);
            });
            obj[k + "_name"] = v.name;
          }
        } else obj[k] = v;
      }
      options = { ...options, body: obj };
    }
    return await tsLocalApi(path, options);
  } catch (e) {
    console.error(e);
    return { ok: false, error: e.message || "Local DB error." };
  }
}

// A random ID generated once per browser and kept in localStorage. The
// server combines this with the browser's User-Agent to bind a sign-in to
// "this device" -- see session_manager.py. It identifies a browser
// profile, not a person, so it's fine to keep even after sign-out.
function tsDeviceId(){
  let id = localStorage.getItem("ts_device_id");
  if (!id) {
    id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ("dev-" + Date.now() + "-" + Math.random().toString(16).slice(2));
    localStorage.setItem("ts_device_id", id);
  }
  return id;
}

// =========================================================================
// navigation (desktop sidebar + mobile drawer)
// =========================================================================
document.querySelectorAll(".nav-item[data-panel]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-panel]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.panel).classList.add("active");
    setActiveNavGroup(btn);
    closeMobileNav();
    const loaders = {
      overview: renderOverview, notifications: renderNotifications, products: renderProducts, taxslabs: renderTaxSlabs,
      coupons: renderCoupons, pospin: loadPosPin,
      clients: renderClients, invoices: renderInvoices, branding: initBranding,
      users: renderUsers, email: loadSmtpForm,
      suppliers: renderSuppliers, purchases: renderPurchases, analytics: renderAnalytics, shifts: renderShifts, pricelists: renderPriceLists, reorder: renderReorderAdmin,
      quotations: renderQuotations, dueinvoices: renderDueInvoices, inventory: renderInventory, codes: renderCodes,
      database: renderDatabasePanel, sessions: renderSessions,
      lowstock: renderLowStock, expiring: renderExpiringBatches, returns: renderReturnsAdmin,
      profitmargin: renderProfitMargin, deadstock: renderDeadstock, fastmoving: renderFastMoving, overridelog: renderOverrideLog,
      variantscreen: renderVariantScreen, cashdayend: renderCashbox,
    };
    if (loaders[btn.dataset.panel]) loaders[btn.dataset.panel]();
    if (btn.dataset.panel === "analytics") {
      setTimeout(function(){
        try{
          if (typeof revenueChartObj !== "undefined" && revenueChartObj) revenueChartObj.resize();
          if (typeof productsChartObj !== "undefined" && productsChartObj) productsChartObj.resize();
          if (typeof clientsChartObj !== "undefined" && clientsChartObj) clientsChartObj.resize();
        }catch(e){}
      }, 100);
      setTimeout(function(){
        try{
          if (typeof revenueChartObj !== "undefined" && revenueChartObj) revenueChartObj.resize();
          if (typeof productsChartObj !== "undefined" && productsChartObj) productsChartObj.resize();
          if (typeof clientsChartObj !== "undefined" && clientsChartObj) clientsChartObj.resize();
        }catch(e){}
      }, 350);
    }
  });
});

// ---------- collapsible sidebar groups ----------
function setActiveNavGroup(activeBtn){
  document.querySelectorAll(".nav-group").forEach(g => g.classList.remove("has-active"));
  const group = activeBtn.closest(".nav-group");
  if (group) { group.classList.add("has-active"); group.classList.add("open"); }
}
document.querySelectorAll(".nav-group-head").forEach(head => {
  head.addEventListener("click", () => {
    const group = head.closest(".nav-group");
    const wasOpen = group.classList.contains("open");
    document.querySelectorAll(".nav-group").forEach(g => g.classList.remove("open"));
    if (!wasOpen) group.classList.add("open");
  });
});
function openMobileNav(){
  var side = document.getElementById("sidebar");
  var scrim = document.getElementById("mobileScrim");
  if(side){ side.classList.add("mobile-open"); side.style.display = "flex"; }
  if(scrim){ scrim.classList.add("show"); }
  try{ document.documentElement.classList.add("m-menu-open"); document.body.classList.add("m-menu-open"); }catch(e){}
}
function closeMobileNav(){
  var side = document.getElementById("sidebar");
  var scrim = document.getElementById("mobileScrim");
  if(side){ side.classList.remove("mobile-open"); side.style.display = ""; }
  if(scrim){ scrim.classList.remove("show"); }
  try{
    document.documentElement.classList.remove("m-menu-open");
    document.body.classList.remove("m-menu-open");
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }catch(e){}
}
// Ensure page can always scroll after load
(function(){
  function unlock(){
    try{
      if(!document.body.classList.contains("m-menu-open")){
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
    }catch(e){}
  }
  unlock();
  document.addEventListener("DOMContentLoaded", unlock);
  window.addEventListener("pageshow", unlock);
  setTimeout(unlock, 100);
  setTimeout(unlock, 500);
})();
(function bindAdminHamburger(){
  function bind(){
    var btn = document.getElementById("hamburgerBtn");
    var scrim = document.getElementById("mobileScrim");
    if(btn && !btn.dataset.bound){
      btn.dataset.bound = "1";
      function toggle(e){
        try{ e.preventDefault(); e.stopPropagation(); }catch(err){}
        var side = document.getElementById("sidebar");
        if(side && side.classList.contains("mobile-open")) closeMobileNav();
        else openMobileNav();
      }
      btn.addEventListener("click", toggle, true);
      btn.addEventListener("touchend", function(e){ toggle(e); }, {passive:false});
    }
    if(scrim && !scrim.dataset.bound){
      scrim.dataset.bound = "1";
      scrim.addEventListener("click", closeMobileNav);
    }
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  setTimeout(bind, 300);
})();
/* Change Panel dropdown (3-dashes / sidebar) */
(function bindPanelSwitch(){
  function bind(){
    var btn = document.getElementById("panelSwitchBtn");
    var menu = document.getElementById("panelSwitchMenu");
    if(!btn || !menu || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    function closeMenu(){
      menu.hidden = true;
      btn.setAttribute("aria-expanded","false");
    }
    function toggleMenu(e){
      try{ e.preventDefault(); e.stopPropagation(); }catch(err){}
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", toggleMenu);
    btn.addEventListener("touchend", function(e){ toggleMenu(e); }, {passive:false});
    document.addEventListener("click", function(e){
      if(!menu.hidden && !btn.contains(e.target) && !menu.contains(e.target)) closeMenu();
    });
    menu.querySelectorAll("a.panel-switch-item").forEach(function(a){
      a.addEventListener("click", function(e){
        try{ e.preventDefault(); e.stopPropagation(); }catch(err){}
        var href = a.getAttribute("href") || a.getAttribute("data-href") || "";
        if(!href) return;
        try{
          if(typeof tsRememberPanel === "function") tsRememberPanel(href);
          else localStorage.setItem("ts_last_panel", href);
        }catch(err){}
        window.location.assign(href);
      });
    });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  setTimeout(bind, 300);
})();
/* X close — fixed under top bar on the right; goes back to Overview */
(function bindPanelCloseX(){
  function isOverviewActive(){
    var ov = document.getElementById("panel-overview");
    return !!(ov && ov.classList.contains("active"));
  }
  function syncFloat(){
    try{
      if(isOverviewActive()) document.body.classList.remove("has-panel-open");
      else document.body.classList.add("has-panel-open");
    }catch(e){}
  }
  function goOverview(){
    var overviewBtn = document.querySelector('.nav-item[data-panel="overview"]');
    if(overviewBtn) overviewBtn.click();
    else {
      document.querySelectorAll(".panel").forEach(function(p){ p.classList.remove("active"); });
      var ov = document.getElementById("panel-overview");
      if(ov) ov.classList.add("active");
      document.querySelectorAll(".nav-item[data-panel]").forEach(function(b){ b.classList.remove("active"); });
      if(overviewBtn) overviewBtn.classList.add("active");
    }
    document.body.classList.remove("has-panel-open");
    try{ if(window.matchMedia && window.matchMedia("(max-width:900px)").matches) closeMobileNav(); }catch(e){}
  }
  function bind(){
    var btn = document.getElementById("panelCloseFloat");
    if(btn && !btn.dataset.bound){
      btn.dataset.bound = "1";
      btn.addEventListener("click", function(e){
        try{ e.preventDefault(); e.stopPropagation(); }catch(err){}
        goOverview();
      });
    }
    syncFloat();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  setTimeout(bind, 300);
  window.__orbitSyncPanelClose = syncFloat;
})();
document.querySelectorAll(".nav-item[data-panel]").forEach(function(btn){
  btn.addEventListener("click", function(){
    if(window.matchMedia && window.matchMedia("(max-width:900px)").matches) closeMobileNav();
    setTimeout(function(){
      try{ if(window.__orbitSyncPanelClose) window.__orbitSyncPanelClose(); }catch(e){}
    }, 30);
  });
});

document.querySelectorAll(".modal-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    const parent = tab.closest(".modal");
    parent.querySelectorAll(".modal-tab").forEach(t => t.classList.remove("active"));
    parent.querySelectorAll(".modal-tabpanel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    parent.querySelector("#tab-" + tab.dataset.tab).classList.add("active");
  });
});

// =========================================================================
// OVERVIEW
// =========================================================================
async function renderOverview(){
  const data = await api("/overview");
  if (!data.ok) return;
  document.getElementById("statProducts").textContent = data.stats.products;
  document.getElementById("statClients").textContent = data.stats.clients;
  document.getElementById("statInvoices").textContent = data.stats.invoices;
  document.getElementById("statLowStock").textContent = data.stats.lowStock;
  document.getElementById("statTotalCredits").textContent = money(data.stats.totalClientCredits);
  const rp = document.getElementById("statRevenuePaid");
  const ru = document.getElementById("statRevenueUnpaid");
  if (rp) rp.textContent = money(data.stats.revenuePaid || 0);
  if (ru) ru.textContent = money(data.stats.revenueUnpaid || 0);
  const pc = document.getElementById("statPayCash");
  const pb = document.getElementById("statPayBank");
  const po = document.getElementById("statPayOther");
  if (pc) pc.textContent = money(data.stats.paymentsCash || 0);
  if (pb) pb.textContent = money(data.stats.paymentsBank || 0);
  if (po) po.textContent = money(data.stats.paymentsOther || 0);
  const rc = document.getElementById("statReturnsCount");
  const rt = document.getElementById("statReturnsTotal");
  if (rc) rc.textContent = data.stats.returnsCount || 0;
  if (rt) rt.textContent = money(data.stats.returnsTotal || 0);
  const mtp = document.getElementById("statMoneyToPay");
  const mtr = document.getElementById("statMoneyToReceive");
  const mrcv = document.getElementById("statMoneyReceived");
  if (mtp) mtp.textContent = money(data.stats.moneyToPay || 0);
  if (mtr) mtr.textContent = money(data.stats.moneyToReceive || 0);
  if (mrcv) mrcv.textContent = money(data.stats.moneyReceived || 0);

  const tbody = document.getElementById("lowStockTable").querySelector("tbody");
  tbody.innerHTML = data.lowStockProducts.map(p => `
    <tr><td>${escapeHtml(p.name)}</td><td><span class="pill ${p.store_type}">${escapeHtml(p.store_type)}</span></td><td>${p.stock}</td><td>${p.low_stock_limit ?? "default"}</td></tr>
  `).join("");
  document.getElementById("lowStockEmpty").style.display = data.lowStockProducts.length ? "none" : "block";
}

// =========================================================================
// TAX SLABS (loaded early — products panel depends on the list)
// =========================================================================
let taxSlabsCache = [];
async function loadTaxSlabsCache(){
  const data = await api("/tax-slabs");
  if (data.ok) taxSlabsCache = data.taxSlabs;
  return taxSlabsCache;
}

async function renderTaxSlabs(){
  await loadTaxSlabsCache();
  const tbody = document.getElementById("taxSlabsTableBody");
  tbody.innerHTML = taxSlabsCache.map(t => `
    <tr>
      <td>${escapeHtml(t.name)}</td><td>${t.percentage}%</td>
      <td>${t.is_default ? '<span class="pill retail">Default</span>' : ''}</td>
      <td>
        <span class="actions-cell">
        <button class="btn btn-ghost btn-sm" onclick="editTaxSlab(${t.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTaxSlab(${t.id})">Delete</button>
        ${moreBtn(`onclick="taxMore(${t.id})"`)}
        </span>
      </td>
    </tr>
  `).join("");
  document.getElementById("taxSlabsEmpty").style.display = taxSlabsCache.length ? "none" : "block";
}

document.getElementById("openAddTaxSlab").addEventListener("click", () => {
  document.getElementById("taxSlabForm").reset();
  document.getElementById("taxSlabId").value = "";
  document.getElementById("taxSlabModalTitle").textContent = "Add tax slab";
  document.getElementById("taxSlabFormMsg").textContent = "";
  openModal("taxSlabModal");
});

function taxMore(id){
  const t = (taxSlabsCache||[]).find(x => Number(x.id)===Number(id));
  if(!t){ editTaxSlab(id); return; }
  openAdminActions(t.name||"Tax slab", t.percentage != null ? (t.percentage+"%") : "", [
    { label: "Edit", primary: true, run: () => editTaxSlab(t.id) },
    { label: "Delete", danger: true, run: () => deleteTaxSlab(t.id) },
  ]);
}
function editTaxSlab(id){
  const t = taxSlabsCache.find(x => x.id === id);
  if (!t) return;
  document.getElementById("taxSlabId").value = t.id;
  document.getElementById("tsName").value = t.name;
  document.getElementById("tsPercentage").value = t.percentage;
  document.getElementById("tsDefault").checked = !!t.is_default;
  document.getElementById("taxSlabModalTitle").textContent = "Edit tax slab";
  document.getElementById("taxSlabFormMsg").textContent = "";
  openModal("taxSlabModal");
}

async function deleteTaxSlab(id){
  if (!confirm("Delete this tax slab?")) return;
  const data = await api(`/tax-slabs/${id}`, { method: "DELETE" });
  if (!data.ok) { alert(data.error || "Could not delete tax slab."); return; }
  renderTaxSlabs();
}

document.getElementById("taxSlabForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("taxSlabId").value;
  const payload = {
    name: document.getElementById("tsName").value.trim(),
    percentage: parseFloat(document.getElementById("tsPercentage").value) || 0,
    isDefault: document.getElementById("tsDefault").checked,
  };
  const msg = document.getElementById("taxSlabFormMsg");
  const data = id ? await api(`/tax-slabs/${id}`, { method: "PUT", body: payload })
                   : await api("/tax-slabs", { method: "POST", body: payload });
  if (!data.ok) { msg.textContent = data.error || "Could not save tax slab."; msg.className = "msg error"; return; }
  closeModal("taxSlabModal");
  await loadTaxSlabsCache();
  renderTaxSlabs();
  renderProducts();
});

// =========================================================================
// PRODUCTS
// =========================================================================
let productsCache = [];
function initialsColor(name){
  const colors = ["#0b3d91","#158a53","#b8860b","#8e44ad","#c0392b","#2f6feb"];
  let hash = 0;
  for (const ch of (name || "P")) hash = (hash * 31 + ch.charCodeAt(0)) % colors.length;
  return colors[Math.abs(hash) % colors.length];
}

// ---------- Native "More" action sheet (phone) ----------
window.__aasHandlers = [];
function openAdminActions(title, subtitle, actions){
  const sheet = document.getElementById("adminActionSheet");
  const titleEl = document.getElementById("aasTitle");
  const subEl = document.getElementById("aasSub");
  const infoEl = document.getElementById("aasInfo");
  const body = document.getElementById("aasActions");
  if(!sheet || !body) return;
  if(titleEl) titleEl.textContent = title || "Actions";
  if(subEl){ subEl.textContent = subtitle || ""; subEl.style.display = subtitle ? "block" : "none"; }
  if(infoEl){ infoEl.style.display = "none"; infoEl.innerHTML = ""; }
  window.__aasHandlers = Array.isArray(actions) ? actions : [];
  body.innerHTML = window.__aasHandlers.map((a, i) => {
    const danger = a.danger ? " btn-danger" : (a.primary ? " btn-primary" : " btn-ghost");
    return `<button type="button" class="btn${danger}" data-aas="${i}">${escapeHtml(a.label||"Action")}</button>`;
  }).join("");
  body.querySelectorAll("[data-aas]").forEach(btn => {
    btn.addEventListener("click", function(){
      const idx = parseInt(this.getAttribute("data-aas"), 10);
      const act = window.__aasHandlers[idx];
      closeModal("adminActionSheet");
      try{ if(act && typeof act.run === "function") act.run(); }catch(e){ console.error(e); }
    });
  });
  openModal("adminActionSheet");
}
function openAdminInfo(title, subtitle, fields, extraActions){
  const sheet = document.getElementById("adminActionSheet");
  const titleEl = document.getElementById("aasTitle");
  const subEl = document.getElementById("aasSub");
  const infoEl = document.getElementById("aasInfo");
  const body = document.getElementById("aasActions");
  if(!sheet) return;
  if(titleEl) titleEl.textContent = title || "Details";
  if(subEl){ subEl.textContent = subtitle || ""; subEl.style.display = subtitle ? "block" : "none"; }
  if(infoEl){
    infoEl.style.display = "flex";
    infoEl.innerHTML = (fields||[]).map(f =>
      `<div class="aas-row"><span class="aas-k">${escapeHtml(f.label||"")}</span><span class="aas-v">${f.html != null ? f.html : escapeHtml(String(f.value??"—"))}</span></div>`
    ).join("");
  }
  window.__aasHandlers = Array.isArray(extraActions) ? extraActions : [];
  if(body){
    body.innerHTML = window.__aasHandlers.map((a, i) => {
      const danger = a.danger ? " btn-danger" : (a.primary ? " btn-primary" : " btn-ghost");
      return `<button type="button" class="btn${danger}" data-aas="${i}">${escapeHtml(a.label||"Action")}</button>`;
    }).join("");
    body.querySelectorAll("[data-aas]").forEach(btn => {
      btn.addEventListener("click", function(){
        const idx = parseInt(this.getAttribute("data-aas"), 10);
        const act = window.__aasHandlers[idx];
        closeModal("adminActionSheet");
        try{ if(act && typeof act.run === "function") act.run(); }catch(e){ console.error(e); }
      });
    });
  }
  openModal("adminActionSheet");
}
function moreBtn(onClickAttr){
  return `<button type="button" class="row-more-btn" ${onClickAttr}>More</button>`;
}

async function renderProducts(filter){
  await loadTaxSlabsCache();
  const qRaw = filter !== undefined ? filter : (document.getElementById("productSearch")?.value || "");
  const q = String(qRaw || "").trim().toLowerCase();
  const data = await api("/products" + (q ? `?q=${encodeURIComponent(q)}` : ""));
  if (!data.ok) return;
  productsCache = data.products || [];

  // Populate category/brand filter dropdowns from whatever's loaded.
  const catSel = document.getElementById("productCategoryFilter");
  const brandSel = document.getElementById("productBrandFilter");
  if (catSel && brandSel) {
    const cats = [...new Set(productsCache.map(p => p.category).filter(Boolean))].sort();
    const brands = [...new Set(productsCache.map(p => p.brand).filter(Boolean))].sort();
    const curCat = catSel.value, curBrand = brandSel.value;
    catSel.innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    brandSel.innerHTML = '<option value="">All brands</option>' + brands.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
    catSel.value = curCat; brandSel.value = curBrand;
  }

  const catFilter = catSel ? catSel.value : "";
  const brandFilter = brandSel ? brandSel.value : "";
  const lowOnly = document.getElementById("productLowStockFilter")?.checked;
  // Client-side safety net: also filter by search text (API may return unfiltered on older Db.js)
  const rows = productsCache.filter(p => {
    if (catFilter && p.category !== catFilter) return false;
    if (brandFilter && p.brand !== brandFilter) return false;
    if (lowOnly && Number(p.stock) > Number(p.low_stock_limit || 5)) return false;
    if (q) {
      const hay = [p.name, p.brand, p.sku, p.barcode, p.category, p.hsn_code, p.notes]
        .map(x => String(x || "").toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const tbody = document.getElementById("productsTableBody");
  tbody.innerHTML = rows.map(p => {
    const thumb = p.photo_path
      ? `<img class="row-thumb" src="${escapeHtml(p.photo_path)}" alt="">`
      : `<div class="row-thumb placeholder" style="background:${initialsColor(p.name)}22;color:${initialsColor(p.name)};">${escapeHtml((p.name||"P")[0].toUpperCase())}</div>`;
    const taxLabel = p.tax_name
      ? `${escapeHtml(p.tax_name)}${p.tax_percentage != null ? ` <span style="color:var(--slate);font-size:12px">(${Number(p.tax_percentage)}%)</span>` : ""}`
      : (p.tax_percentage ? `${Number(p.tax_percentage)}%` : "&mdash;");
    return `
    <tr>
      <td><input type="checkbox" class="prod-check" value="${p.id}"></td><td>${thumb}</td>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(p.brand)}</td>
      <td><span class="pill ${p.store_type}">${escapeHtml(p.store_type)}</span></td>
      <td>${taxLabel}</td>
      <td>${escapeHtml(p.unit)}</td>
      <td>${Number(p.price).toFixed(2)}</td>
      <td>${p.stock}${p.has_variants ? ` <span style="color:var(--slate);font-size:11px" title="Variant stock total">(+${p.variant_stock||0} var)</span>` : ""}</td>
      <td>${p.expiry_date ? escapeHtml(String(p.expiry_date).slice(0,10)) : "—"}</td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-sm" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="showBarcode(${p.id})">Barcode</button>
        <button class="btn btn-ghost btn-sm" onclick="openVariants(${p.id})">Variants</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Delete</button>
        ${moreBtn(`onclick="productMore(${p.id})"`)}
      </td>
    </tr>`;
  }).join("");
  document.getElementById("productsEmpty").style.display = rows.length ? "none" : "block";
}

function productMore(id){
  const p = (productsCache||[]).find(x => Number(x.id) === Number(id));
  if(!p){ openAdminInfo("Product", "#"+id, [{label:"Status", value:"Not in cache — try refresh"}]); return; }
  openAdminActions(p.name || "Product", [p.brand, p.sku, p.barcode].filter(Boolean).join(" · "), [
    { label: "Edit product", primary: true, run: () => editProduct(p.id) },
    { label: "Barcode / QR", run: () => showBarcode(p.id) },
    { label: "Variants & batches", run: () => openVariants(p.id) },
    { label: "Product details", run: () => openAdminInfo(p.name, "Product info", [
        {label:"Brand", value: p.brand||"—"},
        {label:"Category", value: p.category||"—"},
        {label:"SKU", value: p.sku||"—"},
        {label:"Barcode", value: p.barcode||"—"},
        {label:"Price", value: Number(p.price||0).toFixed(2)},
        {label:"Stock", value: String(p.stock??"—")},
        {label:"Unit", value: p.unit||"—"},
        {label:"Tax", value: p.tax_name || (p.tax_percentage != null ? p.tax_percentage+"%" : "—")},
        {label:"Expiry", value: p.expiry_date ? String(p.expiry_date).slice(0,10) : "—"},
        {label:"Notes", value: p.notes||"—"},
      ], [
        { label: "Edit", primary: true, run: () => editProduct(p.id) },
        { label: "Delete", danger: true, run: () => deleteProduct(p.id) },
      ])},
    { label: "Delete", danger: true, run: () => deleteProduct(p.id) },
  ]);
}
document.getElementById("productSearch").addEventListener("input", e => renderProducts(e.target.value));
document.getElementById("productCategoryFilter")?.addEventListener("change", () => renderProducts(document.getElementById("productSearch").value));
document.getElementById("productBrandFilter")?.addEventListener("change", () => renderProducts(document.getElementById("productSearch").value));
document.getElementById("productLowStockFilter")?.addEventListener("change", () => renderProducts(document.getElementById("productSearch").value));

function fillTaxSlabSelect(selectEl, selectedId){
  selectEl.innerHTML = '<option value="">No tax</option>' + taxSlabsCache.map(t =>
    `<option value="${t.id}" ${String(t.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(t.name)} (${t.percentage}%)</option>`
  ).join("");
}

document.getElementById("openAddProduct").addEventListener("click", async () => {
  await loadTaxSlabsCache();
  document.getElementById("productForm").reset();
  document.getElementById("productId").value = "";
  document.getElementById("productFormMsg").textContent = "";
  document.getElementById("productModalTitle").textContent = "Add product";
  document.getElementById("pPhotoPreview").style.display = "none";
  document.getElementById("pPhotoPlaceholder").style.display = "flex";
  fillTaxSlabSelect(document.getElementById("pTaxSlab"), "");
  openModal("productModal");
});

async function editProduct(id){
  const p = productsCache.find(x => x.id === id);
  if (!p) return;
  await loadTaxSlabsCache();
  document.getElementById("productId").value = p.id;
  document.getElementById("pName").value = p.name;
  document.getElementById("pBrand").value = p.brand || "";
  document.getElementById("pStoreType").value = p.store_type;
  document.getElementById("pCategory").value = p.category || "";
  document.getElementById("pUnit").value = p.unit;
  document.getElementById("pPrice").value = p.price;
  const pit = document.getElementById("pPriceIncludesTax"); if (pit) pit.checked = !!(p.price_includes_tax);
  document.getElementById("pStock").value = p.stock;
  document.getElementById("pLowLimit").value = p.low_stock_limit || "";
  document.getElementById("pSku").value = p.sku || "";
  if (document.getElementById("pCost")) document.getElementById("pCost").value = p.cost_price || 0;
  if (document.getElementById("pBarcode")) document.getElementById("pBarcode").value = p.barcode || "";
  if (document.getElementById("pExpiry")) document.getElementById("pExpiry").value = (p.expiry_date || "").slice(0, 10);
  document.getElementById("pHsn").value = p.hsn_code || "";
  document.getElementById("pNotes").value = p.notes || "";
  document.getElementById("pRemovePhoto").checked = false;
  document.getElementById("pPhoto").value = "";
  fillTaxSlabSelect(document.getElementById("pTaxSlab"), p.tax_slab_id || "");
  if (p.photo_path) {
    document.getElementById("pPhotoPreview").src = p.photo_path;
    document.getElementById("pPhotoPreview").style.display = "block";
    document.getElementById("pPhotoPlaceholder").style.display = "none";
  } else {
    document.getElementById("pPhotoPreview").style.display = "none";
    document.getElementById("pPhotoPlaceholder").style.display = "flex";
  }
  document.getElementById("productModalTitle").textContent = "Edit product";
  document.getElementById("productFormMsg").textContent = "";
  openModal("productModal");
}

document.getElementById("pPhoto").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  document.getElementById("pPhotoPreview").src = url;
  document.getElementById("pPhotoPreview").style.display = "block";
  document.getElementById("pPhotoPlaceholder").style.display = "none";
});

async function deleteProduct(id){
  if (!confirm("Delete this product?")) return;
  await api(`/products/${id}`, { method: "DELETE" });
  renderProducts();
  renderOverview();
}

document.getElementById("clearProducts").addEventListener("click", async () => {
  if (!confirm("Delete ALL products? This can't be undone.")) return;
  await api("/products/clear", { method: "POST" });
  renderProducts();
  renderOverview();
});

document.getElementById("productForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("productId").value;
  const msg = document.getElementById("productFormMsg");
  const fd = new FormData();
  fd.set("name", document.getElementById("pName").value.trim());
  fd.set("brand", document.getElementById("pBrand").value.trim());
  fd.set("storeType", document.getElementById("pStoreType").value);
  fd.set("category", document.getElementById("pCategory").value.trim());
  fd.set("unit", document.getElementById("pUnit").value);
  fd.set("taxSlabId", document.getElementById("pTaxSlab").value);
  fd.set("price", document.getElementById("pPrice").value);
  fd.set("priceIncludesTax", document.getElementById("pPriceIncludesTax")?.checked ? "1" : "0");
  fd.set("stock", document.getElementById("pStock").value);
  fd.set("lowStockLimit", document.getElementById("pLowLimit").value);
  fd.set("sku", document.getElementById("pSku").value.trim());
  fd.set("costPrice", document.getElementById("pCost") ? document.getElementById("pCost").value : "0");
  fd.set("barcode", document.getElementById("pBarcode") ? document.getElementById("pBarcode").value.trim() : "");
  fd.set("expiryDate", document.getElementById("pExpiry") ? document.getElementById("pExpiry").value : "");
  fd.set("hsnCode", document.getElementById("pHsn").value.trim());
  fd.set("notes", document.getElementById("pNotes").value.trim());
  if (document.getElementById("pPhoto").files[0]) fd.set("photo", document.getElementById("pPhoto").files[0]);
  if (id && document.getElementById("pRemovePhoto").checked) fd.set("removePhoto", "1");

  const data = id ? await api(`/products/${id}`, { method: "PUT", body: fd })
                  : await api("/products", { method: "POST", body: fd });
  if (!data.ok) { msg.textContent = data.error || "Could not save product."; msg.className = "msg error"; return; }
  closeModal("productModal");
  renderProducts();
  renderOverview();
});

// =========================================================================
// CLIENTS
// =========================================================================
let clientsCache = [];
async function renderClients(filter){
  const q = filter !== undefined ? filter : document.getElementById("clientSearch").value;
  const data = await api("/clients" + (q ? `?q=${encodeURIComponent(q)}` : ""));
  if (!data.ok) return;
  clientsCache = data.clients;
  const tbody = document.getElementById("clientsTableBody");
  tbody.innerHTML = clientsCache.map(c => `
    <tr>
      <td><input type="checkbox" class="client-check" value="${c.id}"></td>
      <td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.email)}</td><td>${escapeHtml(c.phone)}</td>
      <td><span class="credit-amount ${c.credit_balance >= 0 ? 'pos' : 'neg'}">${money(c.credit_balance)}</span></td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-sm" onclick="editClient(${c.id})">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="openClientDetail(${c.id})">History</button>
        <button class="btn btn-ghost btn-sm" onclick="openStatement(${c.id})">Statement</button>
        <button class="btn btn-ghost btn-sm" onclick="composeToClient('${escapeHtml(c.email||"")}')">Email</button>
        <button class="btn btn-danger btn-sm" onclick="deleteClient(${c.id})">Delete</button>
        ${moreBtn(`onclick="clientMore(${c.id})"`)}
      </td>
    </tr>
  `).join("");
  document.getElementById("clientsEmpty").style.display = clientsCache.length ? "none" : "block";
}

function clientMore(id){
  const c = (clientsCache||[]).find(x => Number(x.id) === Number(id));
  if(!c) return;
  openAdminActions(c.name || "Client", c.phone || c.email || "", [
    { label: "Edit client", primary: true, run: () => editClient(c.id) },
    { label: "History", run: () => openClientDetail(c.id) },
    { label: "Statement", run: () => openStatement(c.id) },
    { label: "Email", run: () => composeToClient(c.email||"") },
    { label: "Client details", run: () => openAdminInfo(c.name, "Client info", [
        {label:"Email", value: c.email||"—"},
        {label:"Phone", value: c.phone||"—"},
        {label:"Credit balance", value: money(c.credit_balance)},
        {label:"Address", value: c.address||"—"},
        {label:"GSTIN", value: c.gstin||c.tax_id||"—"},
        {label:"Notes", value: c.notes||"—"},
      ], [{ label: "Edit", primary: true, run: () => editClient(c.id) }])},
    { label: "Delete", danger: true, run: () => deleteClient(c.id) },
  ]);
}
document.getElementById("clientSearch").addEventListener("input", e => renderClients(e.target.value));
document.getElementById("openAddClient").addEventListener("click", () => {
  document.getElementById("clientForm").reset();
  document.getElementById("clientId").value = "";
  document.getElementById("clientFormMsg").textContent = "";
  openModal("clientModal");
});

function editClient(id){
  const c = clientsCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById("clientId").value = c.id;
  document.getElementById("cName").value = c.name;
  document.getElementById("cEmail").value = c.email || "";
  document.getElementById("cPhone").value = c.phone || "";
  document.getElementById("cGstin").value = c.gstin || "";
  document.getElementById("cAddress").value = c.address || "";
  document.getElementById("cNotes").value = c.notes || "";
  document.getElementById("clientFormMsg").textContent = "";
  openModal("clientModal");
}

async function deleteClient(id){
  if (!confirm("Delete this client?")) return;
  await api(`/clients/${id}`, { method: "DELETE" });
  renderClients();
  renderOverview();
}

document.getElementById("clearClients").addEventListener("click", async () => {
  if (!confirm("Delete ALL clients? This can't be undone.")) return;
  await api("/clients/clear", { method: "POST" });
  renderClients();
  renderOverview();
});

document.getElementById("clientForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("clientId").value;
  const msg = document.getElementById("clientFormMsg");
  const payload = {
    name: document.getElementById("cName").value.trim(),
    email: document.getElementById("cEmail").value.trim(),
    phone: document.getElementById("cPhone").value.trim(),
    gstin: document.getElementById("cGstin").value.trim(),
    address: document.getElementById("cAddress").value.trim(),
    notes: document.getElementById("cNotes").value.trim(),
  };
  const data = id ? await api(`/clients/${id}`, { method: "PUT", body: payload })
                  : await api("/clients", { method: "POST", body: payload });
  if (!data.ok) { msg.textContent = data.error || "Could not save client."; msg.className = "msg error"; return; }
  closeModal("clientModal");
  renderClients();
  renderOverview();
});

let activeClientDetailId = null;
async function openClientDetail(id){
  activeClientDetailId = id;
  const data = await api(`/clients/${id}/history`);
  if (!data.ok) { alert(data.error || "Could not load client."); return; }
  document.getElementById("clientDetailName").textContent = data.client.name;
  document.getElementById("clientHistoryTotal").textContent = money(data.totalSpent);
  const htbody = document.getElementById("clientHistoryTableBody");
  htbody.innerHTML = data.invoices.map(inv => `
    <tr>
      <td>${escapeHtml(inv.invoice_number)}</td><td>${(inv.items||[]).length ?? ''}</td>
      <td>${money(inv.total)}</td><td><span class="pill ${inv.status}">${escapeHtml(inv.status)}</span></td>
      <td>${inv.created_at ? formatIndiaTime(inv.created_at) : ""}</td>
    </tr>
  `).join("");
  document.getElementById("clientHistoryEmpty").style.display = data.invoices.length ? "none" : "block";

  document.getElementById("clientCreditBalance").textContent = money(data.client.credit_balance);
  const ctbody = document.getElementById("creditLogTableBody");
  ctbody.innerHTML = data.creditTransactions.map(t => `
    <tr>
      <td>${t.created_at ? formatIndiaTime(t.created_at) : ""}</td>
      <td><span class="credit-amount ${t.amount >= 0 ? 'pos' : 'neg'}">${t.amount >= 0 ? '+' : ''}${money(t.amount)}</span></td>
      <td>${escapeHtml(t.reason)}</td><td>${money(t.balance_after)}</td>
    </tr>
  `).join("");

  document.getElementById("creditAdjustForm").reset();
  document.getElementById("creditFormMsg").textContent = "";
  document.querySelectorAll("#clientDetailModal .modal-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll("#clientDetailModal .modal-tabpanel").forEach(p => p.classList.remove("active"));
  document.querySelector('#clientDetailModal .modal-tab[data-tab="history"]').classList.add("active");
  document.getElementById("tab-history").classList.add("active");
  openModal("clientDetailModal");
}

document.getElementById("creditAdjustForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("creditFormMsg");
  const payload = {
    amount: parseFloat(document.getElementById("creditAmount").value),
    reason: document.getElementById("creditReason").value.trim(),
  };
  const data = await api(`/clients/${activeClientDetailId}/credits`, { method: "POST", body: payload });
  if (!data.ok) { msg.textContent = data.error || "Could not apply credit change."; msg.className = "msg error"; return; }
  msg.textContent = "Applied."; msg.className = "msg success";
  openClientDetail(activeClientDetailId);
  renderClients();
  renderOverview();
});

// =========================================================================
// INVOICES
// =========================================================================
let invoicesCache = [];
let invItemCounter = 0;

function addInvItemRow(item){
  item = item || {};
  const id = "row" + (invItemCounter++);
  const wrap = document.getElementById("invItemsBuilder");
  const row = document.createElement("div");
  row.className = "item-row";
  row.dataset.rowId = id;
  const productOptions = ['<option value="">Custom item</option>'].concat(
    productsCache.map(p => `<option value="${p.id}" data-price="${p.price}" data-tax="${p.tax_percentage || 0}">${escapeHtml(p.name)}</option>`)
  ).join("");
  row.innerHTML = `
    <select class="inv-item-product">${productOptions}</select>
    <input type="number" class="inv-item-qty" min="0" step="1" placeholder="Qty" value="${item.qty || 1}">
    <input type="number" class="inv-item-price" min="0" step="0.01" placeholder="Price" value="${item.price || 0}">
    <input type="number" class="inv-item-tax" min="0" step="0.01" placeholder="Tax %" value="${item.taxPercent || 0}">
    <button type="button" title="Remove line">&times;</button>
  `;
  const nameInput = document.createElement("input");
  nameInput.type = "text"; nameInput.className = "inv-item-name"; nameInput.placeholder = "Item name";
  nameInput.value = item.name || "";
  nameInput.style.display = "none";
  row.insertBefore(nameInput, row.firstChild);

  const select = row.querySelector(".inv-item-product");
  if (item.productId) select.value = item.productId;
  function syncNameVisibility(){
    if (select.value === "") { nameInput.style.display = ""; select.style.display = "none"; }
    else { nameInput.style.display = "none"; select.style.display = ""; }
  }
  select.addEventListener("change", () => {
    const opt = select.selectedOptions[0];
    if (opt && opt.dataset.price !== undefined) {
      row.querySelector(".inv-item-price").value = opt.dataset.price;
      row.querySelector(".inv-item-tax").value = opt.dataset.tax || 0;
    }
    recalcInvoiceTotals();
  });
  row.querySelector("button").addEventListener("click", () => { row.remove(); recalcInvoiceTotals(); });
  row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", recalcInvoiceTotals));
  wrap.appendChild(row);
  recalcInvoiceTotals();
}

function collectInvItems(){
  return Array.from(document.querySelectorAll("#invItemsBuilder .item-row")).map(row => {
    const select = row.querySelector(".inv-item-product");
    const nameField = row.querySelector(".inv-item-name");
    const name = select.value ? select.selectedOptions[0].textContent : nameField.value.trim();
    return {
      productId: select.value ? parseInt(select.value) : null,
      name,
      qty: parseFloat(row.querySelector(".inv-item-qty").value) || 0,
      price: parseFloat(row.querySelector(".inv-item-price").value) || 0,
      taxPercent: parseFloat(row.querySelector(".inv-item-tax").value) || 0,
    };
  }).filter(it => it.name);
}

function recalcInvoiceTotals(){
  const items = collectInvItems();
  const discount = parseFloat(document.getElementById("invDiscount").value) || 0;
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  const tax = items.reduce((s, it) => s + it.qty * it.price * (it.taxPercent / 100), 0);
  const total = Math.max(0, subtotal - discount) + tax;
  document.getElementById("invPreviewSubtotal").textContent = money(subtotal);
  document.getElementById("invPreviewTax").textContent = money(tax);
  document.getElementById("invPreviewDiscount").textContent = money(discount);
  document.getElementById("invPreviewTotal").textContent = money(total);
}
document.getElementById("invDiscount").addEventListener("input", recalcInvoiceTotals);
document.getElementById("addInvItemRow").addEventListener("click", () => addInvItemRow());

async function renderInvoices(filter){
  const tbody = document.getElementById("invoicesTableBody");
  const empty = document.getElementById("invoicesEmpty");
  try{
    if(tbody) tbody.innerHTML = `<tr><td colspan="8" style="padding:16px;color:var(--slate)">Loading invoices…</td></tr>`;
    const qRaw = filter !== undefined ? filter : (document.getElementById("invoiceSearch")?.value || "");
    const q = String(qRaw || "").trim().toLowerCase();
    const status = (document.getElementById("invoiceStatusFilter")?.value || "").trim();
    const from = (document.getElementById("invoiceFromFilter")?.value || "").trim();
    const to = (document.getElementById("invoiceToFilter")?.value || "").trim();
    const data = await api("/invoices");
    if (!data || !data.ok) {
      if(tbody) tbody.innerHTML = `<tr><td colspan="8" style="padding:16px;color:var(--red)">${escapeHtml((data&&data.error)||"Could not load invoices")}</td></tr>`;
      return;
    }
    let rows = Array.isArray(data.invoices) ? data.invoices.slice() : [];
    // Client-side filters (IndexedDB list endpoint has no query params)
    if (status) rows = rows.filter(inv => String(inv.status||"") === status);
    if (from) rows = rows.filter(inv => String(inv.created_at||"").slice(0,10) >= from);
    if (to) rows = rows.filter(inv => String(inv.created_at||"").slice(0,10) <= to);
    if (q) {
      rows = rows.filter(inv => {
        const hay = [inv.invoice_number, inv.client_name, inv.status, inv.notes]
          .map(x => String(x||"").toLowerCase()).join(" ");
        return hay.includes(q);
      });
    }
    invoicesCache = rows;
    if(!tbody) return;
    tbody.innerHTML = rows.map(inv => {
      const items = inv.items || [];
      const st = inv.status || "unpaid";
      return `<tr>
      <td><input type="checkbox" class="inv-check" value="${inv.id}"></td>
      <td>${escapeHtml(inv.invoice_number||"")}</td>
      <td>${escapeHtml(inv.client_name||"Walk-in")}</td>
      <td>${items.length} item(s)</td>
      <td>${money(inv.total)}</td>
      <td><span class="pill ${escapeHtml(st)}">${escapeHtml(st)}</span></td>
      <td>${inv.created_at ? formatIndiaTime(inv.created_at) : "—"}</td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-sm" onclick="viewInvoice(${inv.id})">View</button>
        <button class="btn btn-ghost btn-sm" onclick="shareInvoice(${inv.id})">Share</button>
        <button class="btn btn-ghost btn-sm" onclick="whatsappInvoice(${inv.id})">WhatsApp</button>
        <button class="btn btn-ghost btn-sm" onclick="openPayment(${inv.id})">Pay</button>
        <button class="btn btn-ghost btn-sm" onclick="editInvoice(${inv.id})">Edit</button>
        ${st === "unpaid" || st === "partial"
          ? `<button class="btn btn-ghost btn-sm" onclick="markPaid(${inv.id})">Mark paid</button>`
          : `<button class="btn btn-ghost btn-sm" onclick="markUnpaid(${inv.id})">Unpaid</button>`}
        <button class="btn btn-danger btn-sm" onclick="deleteInvoice(${inv.id})">Delete</button>
        ${moreBtn(`onclick="invoiceMore(${inv.id})"`)}
      </td>
    </tr>`;
    }).join("");
    if(empty) empty.style.display = rows.length ? "none" : "block";
  }catch(err){
    console.error("renderInvoices", err);
    if(tbody) tbody.innerHTML = `<tr><td colspan="8" style="padding:16px;color:var(--red)">Error loading invoices</td></tr>`;
  }
}

function invoiceMore(id){
  const inv = (invoicesCache||[]).find(x => Number(x.id) === Number(id));
  if(!inv) return;
  const acts = [
    { label: "View invoice", primary: true, run: () => viewInvoice(inv.id) },
    { label: "Share to apps", primary: true, run: async () => { await viewInvoice(inv.id); setTimeout(function(){ orbitShareInvoiceSocial(inv); }, 400); } },
    { label: "Copy summary", run: () => shareInvoice(inv.id) },
    { label: "WhatsApp", run: () => whatsappInvoice(inv.id) },
    { label: "Record payment", run: () => openPayment(inv.id) },
    { label: "Payment link", run: () => paymentLink(inv.id) },
    { label: "Edit", run: () => editInvoice(inv.id) },
  ];
  if(inv.status === "unpaid") acts.push({ label: "Mark paid", run: () => markPaid(inv.id) });
  else acts.push({ label: "Mark unpaid", run: () => markUnpaid(inv.id) });
  acts.push({ label: "Invoice details", run: () => openAdminInfo(inv.invoice_number||"Invoice", inv.client_name||"", [
    {label:"Status", value: inv.status||"—"},
    {label:"Total", value: money(inv.total)},
    {label:"Items", value: String((inv.items||[]).length)},
    {label:"Created", value: inv.created_at ? formatIndiaTime(inv.created_at) : "—"},
    {label:"Due", value: inv.due_date||"—"},
  ], [{ label: "View", primary: true, run: () => viewInvoice(inv.id) }])});
  acts.push({ label: "Delete", danger: true, run: () => deleteInvoice(inv.id) });
  openAdminActions(inv.invoice_number || "Invoice", inv.client_name || "", acts);
}
document.getElementById("invoiceSearch").addEventListener("input", e => renderInvoices(e.target.value));
document.getElementById("btnExportInvoicesCsv")?.addEventListener("click", async function(){
  try{
    const rows = invoicesCache || [];
    const header = ["invoice_number","client_name","status","total","amount_paid","created_at","due_date"];
    const lines = [header.join(",")];
    rows.forEach(inv => {
      lines.push([
        inv.invoice_number, inv.client_name, inv.status, inv.total, inv.amount_paid, inv.created_at, inv.due_date
      ].map(v => '"' + String(v??"").replace(/"/g,'""') + '"').join(","));
    });
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const filename = "invoices-" + new Date().toISOString().slice(0,10) + ".csv";
    const result = await orbitSaveFile(blob, filename, {
      share: true, title: "Invoices CSV", text: "OrbitBills invoices export",
      mime: "text/csv", dialogTitle: "Save CSV to Files / Downloads"
    });
    if(result && result.ok){
      alert(result.native
        ? ("CSV ready — choose Downloads or Files in the share sheet (" + filename + ")")
        : ("CSV saved to Downloads (" + filename + ")"));
    } else alert("Could not save CSV");
  }catch(err){ console.error(err); alert("Export failed"); }
});

async function populateClientSelect(selectedId){
  const data = await api("/clients");
  const select = document.getElementById("invClientSelect");
  select.innerHTML = '<option value="">Walk-in / type name below</option>' + (data.ok ? data.clients.map(c =>
    `<option value="${c.id}" ${String(c.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(c.name)}</option>`
  ).join("") : "");
}
document.getElementById("invClientSelect").addEventListener("change", e => {
  const opt = e.target.selectedOptions[0];
  if (opt && opt.value) document.getElementById("invClient").value = opt.textContent;
});

document.getElementById("openAddInvoice").addEventListener("click", async () => {
  try{
    await renderProducts();
    await populateClientSelect();
    document.getElementById("invoiceForm").reset();
    document.getElementById("invId").value = "";
    document.getElementById("invNumber").value = "INV-" + Date.now().toString().slice(-6);
    document.getElementById("invItemsBuilder").innerHTML = "";
    addInvItemRow();
    document.getElementById("invoiceModalTitle").textContent = "Create invoice";
    document.getElementById("invoiceFormMsg").textContent = "";
    openModal("invoiceModal");
  }catch(err){
    console.error(err);
    alert("Could not open create invoice");
  }
});

async function editInvoice(id){
  const data = await api(`/invoices/${id}`);
  if (!data.ok) return;
  const inv = data.invoice;
  await renderProducts();
  await populateClientSelect(inv.client_id);
  document.getElementById("invId").value = inv.id;
  document.getElementById("invNumber").value = inv.invoice_number;
  document.getElementById("invClient").value = inv.client_name;
  document.getElementById("invStatus").value = inv.status;
  document.getElementById("invDiscount").value = inv.discount;
  document.getElementById("invNotes").value = inv.notes || "";
  document.getElementById("invItemsBuilder").innerHTML = "";
  const invItems = Array.isArray(inv.items) ? inv.items : [];
  (invItems.length ? invItems : [{}]).forEach(it => addInvItemRow({
    productId: it.product_id, name: it.name, qty: it.qty, price: it.price, taxPercent: it.tax_percent,
  }));
  document.getElementById("invoiceModalTitle").textContent = "Edit invoice";
  document.getElementById("invoiceFormMsg").textContent = "";
  openModal("invoiceModal");
}

async function deleteInvoice(id){
  if (!confirm("Delete this invoice?")) return;
  await api(`/invoices/${id}`, { method: "DELETE" });
  renderInvoices();
  renderOverview();
}

document.getElementById("clearInvoices").addEventListener("click", async () => {
  if (!confirm("Delete ALL invoices? This can't be undone.")) return;
  await api("/invoices/clear", { method: "POST" });
  renderInvoices();
  renderOverview();
});

document.getElementById("invoiceForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("invId").value;
  const msg = document.getElementById("invoiceFormMsg");
  const items = collectInvItems();
  if (!items.length) { msg.textContent = "Add at least one line item."; msg.className = "msg error"; return; }
  const payload = {
    invoiceNumber: document.getElementById("invNumber").value.trim(),
    clientId: document.getElementById("invClientSelect").value ? parseInt(document.getElementById("invClientSelect").value) : null,
    clientName: document.getElementById("invClient").value.trim(),
    status: document.getElementById("invStatus").value,
    discount: parseFloat(document.getElementById("invDiscount").value) || 0,
    creditApplied: parseFloat((document.getElementById("invCredit")||{}).value) || 0,
    notes: document.getElementById("invNotes").value.trim(),
    items,
  };
  const data = id ? await api(`/invoices/${id}`, { method: "PUT", body: payload })
                  : await api("/invoices", { method: "POST", body: payload });
  if (!data.ok) { msg.textContent = data.error || "Could not save invoice."; msg.className = "msg error"; return; }
  closeModal("invoiceModal");
  renderInvoices();
  renderOverview();
});

// =========================================================================
// BRANDING + INVOICE LAYOUT DESIGNER
// =========================================================================
const PAPER_LAYOUT_SPECS = {
  a4:        { w: 600, h: 848, label: "A4", cssClass: "size-a4" },
  a5:        { w: 420, h: 595, label: "A5", cssClass: "size-a5" },
  letter:    { w: 612, h: 792, label: "Letter", cssClass: "size-letter" },
  thermal80: { w: 302, h: 800, label: "Thermal 80mm", cssClass: "size-thermal80" },
  thermal58: { w: 220, h: 700, label: "Thermal 58mm", cssClass: "size-thermal58" },
};
let CANVAS_W = 600, CANVAS_H = 848;
let designerPaperSize = "a4";
let brandingCache = {};
let layoutsCache = [];
let designerElements = [];
let designerSelectedId = null;

function setDesignerPaperSize(size, opts){
  opts = opts || {};
  const spec = PAPER_LAYOUT_SPECS[size] || PAPER_LAYOUT_SPECS.a4;
  designerPaperSize = size;
  CANVAS_W = spec.w;
  CANVAS_H = spec.h;
  const canvas = document.getElementById("designerCanvas");
  if (canvas) {
    canvas.className = "designer-canvas " + spec.cssClass;
  }
  document.querySelectorAll("#paperSizeTabs .paper-size-tab").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-size") === size);
  });
  // Scale existing elements into new bounds if switching size
  if (opts.rescale && designerElements.length) {
    const prevW = opts.prevW || 600, prevH = opts.prevH || 848;
    const sx = CANVAS_W / prevW, sy = CANVAS_H / prevH;
    designerElements.forEach(el => {
      el.x = Math.round(el.x * sx);
      el.y = Math.round(el.y * sy);
      el.w = Math.max(20, Math.round(el.w * sx));
      el.h = Math.max(14, Math.round(el.h * sy));
      el.x = Math.min(el.x, CANVAS_W - el.w);
      el.y = Math.min(el.y, CANVAS_H - el.h);
    });
  }
  if (typeof renderDesigner === "function") renderDesigner();
  if (typeof renderInvoicePreview === "function") renderInvoicePreview();
}

const FIELD_LABELS = {
  logo: "Logo", brand_name: "Brand name", brand_address: "Brand address",
  invoice_meta: "Invoice #/date", bill_to: "Bill to", items_table: "Items table",
  totals: "Totals", footer_note: "Footer note", footer: "Footer note", billing_notes: "Billing notes",
  regulations: "Regulations / terms", orbitbills_badge: "OrbitBills badge",
  upi_qr: "UPI QR",
};
const LOCKED_TYPES = new Set(["orbitbills_badge"]); // never user-deletable if present; watermark is separate

async function initBranding(){
  const [bData, lData] = await Promise.all([api("/branding"), api("/invoice-layouts")]);
  if (bData.ok) brandingCache = bData.branding;
  if (lData.ok) layoutsCache = lData.layouts;

  document.getElementById("bName").value = brandingCache.brand_name || "TechSerenia";
  document.getElementById("bTagline").value = brandingCache.brand_tagline || "OrbitBills";
  document.getElementById("bEmail").value = brandingCache.brand_email || "";
  document.getElementById("bPhone").value = brandingCache.brand_phone || "";
  document.getElementById("bAddress").value = brandingCache.brand_address || "";
  document.getElementById("bAccent").value = brandingCache.accent_color || "#0b3d91";
  document.getElementById("bDefaultLimit").value = brandingCache.default_low_stock_limit || 5;
  if (document.getElementById("bCurrency")) document.getElementById("bCurrency").value = brandingCache.currency_symbol || "₹";
  if (document.getElementById("bUpiId")) document.getElementById("bUpiId").value = brandingCache.upi_id || "";
  if (document.getElementById("bUpiName")) document.getElementById("bUpiName").value = brandingCache.upi_name || "";
  if (document.getElementById("bUpiLink")) document.getElementById("bUpiLink").value = brandingCache.upi_link || "";
  document.getElementById("bFooter").value = brandingCache.footer_note || "";
  if (document.getElementById("bRegulations")) document.getElementById("bRegulations").value = brandingCache.invoice_regulations || "";
  document.getElementById("bShowTsLogo").checked = (brandingCache.show_techserenia_logo || "yes") === "yes";
  const logoSrc = brandingCache.custom_brand_logo || "logo.png";
  document.getElementById("bLogoPreview").src = logoSrc;
  const upiPrev = document.getElementById("bUpiQrPreview");
  if (upiPrev) {
    if (brandingCache.upi_qr_image) {
      upiPrev.src = brandingCache.upi_qr_image;
      upiPrev.style.display = "block";
    } else {
      upiPrev.removeAttribute("src");
      upiPrev.style.display = "none";
    }
  }
  const qrLogoPrev = document.getElementById("bQrLogoPreview");
  if (qrLogoPrev) {
    if (brandingCache.qr_center_logo) {
      qrLogoPrev.src = brandingCache.qr_center_logo;
      qrLogoPrev.style.display = "block";
    } else {
      qrLogoPrev.removeAttribute("src");
      qrLogoPrev.style.display = "none";
    }
  }
  updateBrandingPreviewStrip();
  renderLayoutCards();
  loadLayoutIntoDesigner(activeLayout());
  renderInvoicePreview();
}

function updateBrandingPreviewStrip(){
  document.getElementById("brandingPreviewLogo").src = brandingCache.custom_brand_logo || "logo.png";
  document.getElementById("brandingPreviewName").textContent = document.getElementById("bName").value || "TechSerenia";
  document.getElementById("brandingPreviewTagline").textContent = document.getElementById("bTagline").value || "OrbitBills";
  document.getElementById("brandingPreviewSwatch").style.background = document.getElementById("bAccent").value;
}
["bName","bTagline","bAccent"].forEach(id => document.getElementById(id).addEventListener("input", () => { updateBrandingPreviewStrip(); renderInvoicePreview(); }));
document.getElementById("bLogo").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  document.getElementById("bLogoPreview").src = url;
  document.getElementById("brandingPreviewLogo").src = url;
});


document.getElementById("bUpiQrFile")?.addEventListener("change", e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const prev = document.getElementById("bUpiQrPreview");
    if (prev) { prev.src = reader.result; prev.style.display = "block"; }
    brandingCache.upi_qr_image = reader.result;
    api("/branding", { method: "POST", body: { upi_qr_image: reader.result } }).catch(() => {});
    renderInvoicePreview();
  };
  reader.readAsDataURL(file);
});
document.getElementById("bQrLogoFile")?.addEventListener("change", e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const prev = document.getElementById("bQrLogoPreview");
    if (prev) { prev.src = reader.result; prev.style.display = "block"; }
    brandingCache.qr_center_logo = reader.result;
  };
  reader.readAsDataURL(file);
});
document.getElementById("btnClearUpiQr")?.addEventListener("click", () => {
  const prev = document.getElementById("bUpiQrPreview");
  if (prev) { prev.removeAttribute("src"); prev.style.display = "none"; }
  brandingCache.upi_qr_image = "";
  const f = document.getElementById("bUpiQrFile"); if (f) f.value = "";
  api("/branding", { method: "POST", body: { upi_qr_image: "" } }).catch(() => {});
  renderInvoicePreview();
});
document.getElementById("btnDownloadQr")?.addEventListener("click", () => {
  const prev = document.getElementById("bUpiQrPreview");
  if (!prev || !prev.src || prev.style.display === "none") {
    alert("Generate or upload a QR first.");
    return;
  }
  const a = document.createElement("a");
  a.href = prev.src;
  a.download = "orbitbills-qr.png";
  a.click();
});
document.getElementById("btnGenUpiQr")?.addEventListener("click", async () => {
  const upiId = (document.getElementById("bUpiId")?.value || "").trim();
  const upiName = (document.getElementById("bUpiName")?.value || "").trim() || (document.getElementById("bName")?.value || "Payee");
  const link = (document.getElementById("bUpiLink")?.value || "").trim();
  let payload = link;
  if (!payload && upiId) {
    payload = "upi://pay?pa=" + encodeURIComponent(upiId) + "&pn=" + encodeURIComponent(upiName) + "&cu=INR";
  }
  if (!payload) { alert("Enter any payment or website link, or a UPI ID."); return; }
  const btn = document.getElementById("btnGenUpiQr");
  if (btn) { btn.disabled = true; btn.textContent = "Generating…"; }
  try {
    // Only embed data: logos in QR center (file URLs can break canvas export on phones)
    let qrLogo = brandingCache.qr_center_logo || "";
    const prevLogo = document.getElementById("bQrLogoPreview");
    const invLogo = document.getElementById("bLogoPreview");
    if ((!qrLogo || qrLogo.indexOf("data:") !== 0) && prevLogo && prevLogo.src && prevLogo.src.indexOf("data:") === 0) qrLogo = prevLogo.src;
    if ((!qrLogo || qrLogo.indexOf("data:") !== 0) && invLogo && invLogo.src && invLogo.src.indexOf("data:") === 0) qrLogo = invLogo.src;
    if ((!qrLogo || qrLogo.indexOf("data:") !== 0) && brandingCache.custom_brand_logo && String(brandingCache.custom_brand_logo).indexOf("data:") === 0) {
      qrLogo = brandingCache.custom_brand_logo;
    }
    const dataUrl = await tsMakeUniversalQrWithLogo(payload, qrLogo);
    if (!dataUrl || dataUrl.length < 100) throw new Error("Empty QR image");
    const prev = document.getElementById("bUpiQrPreview");
    if (prev) { prev.src = dataUrl; prev.style.display = "block"; }
    brandingCache.upi_qr_image = dataUrl;
    try { await api("/branding", { method: "POST", body: { upi_qr_image: dataUrl } }); } catch (e) {}
    try { renderInvoicePreview(); } catch (e) {}
  } catch (err) {
    console.error(err);
    alert("Could not generate QR: " + (err && err.message ? err.message : err));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Generate QR"; }
  }
});


/** Ensure davidshimjs QRCode is available. */
async function tsWaitForQrLib(ms){
  ms = ms || 3000;
  if (typeof QRCode === "function") return true;
  if (!document.querySelector('script[data-orbit-qr]')) {
    await new Promise(function(resolve){
      var s = document.createElement("script");
      s.src = "qrcode.min.js";
      s.setAttribute("data-orbit-qr", "1");
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
      setTimeout(resolve, 800);
    });
  }
  var t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (typeof QRCode === "function") return true;
    await new Promise(r => setTimeout(r, 40));
  }
  return typeof QRCode === "function";
}

/** Draw QR modules onto canvas (works with shipped qrcode.min.js). */
async function tsDrawQrToCanvas(targetCanvas, text, opts){
  opts = opts || {};
  const size = opts.size || 512;
  targetCanvas.width = size;
  targetCanvas.height = size;
  const ctx = targetCanvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const ok = await tsWaitForQrLib(3000);
  if (!ok || typeof QRCode !== "function") {
    throw new Error("QR library not loaded. Ensure qrcode.min.js is next to this page.");
  }

  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-9999px;top:0;width:" + size + "px;height:" + size + "px;overflow:hidden";
  document.body.appendChild(holder);
  try {
    const level = (QRCode.CorrectLevel && QRCode.CorrectLevel.H != null) ? QRCode.CorrectLevel.H : 2;
    const qr = new QRCode(holder, {
      text: String(text),
      width: size,
      height: size,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: level
    });
    await new Promise(r => setTimeout(r, 60));

    // Preferred: draw from module matrix (always available on this library)
    const o = qr && qr._oQRCode;
    if (o && o.modules && o.moduleCount) {
      const n = o.moduleCount;
      const cell = size / n;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#000000";
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (o.isDark(r, c)) {
            ctx.fillRect(Math.floor(c * cell), Math.floor(r * cell), Math.ceil(cell), Math.ceil(cell));
          }
        }
      }
      return;
    }

    // Fallback: canvas / img DOM produced by the library
    const canvasEl = holder.querySelector("canvas");
    const imgEl = holder.querySelector("img");
    if (canvasEl) {
      ctx.drawImage(canvasEl, 0, 0, size, size);
      return;
    }
    if (imgEl) {
      await new Promise(function(res){
        if (imgEl.complete && imgEl.naturalWidth) res();
        else { imgEl.onload = res; imgEl.onerror = res; setTimeout(res, 300); }
      });
      if (imgEl.naturalWidth) {
        ctx.drawImage(imgEl, 0, 0, size, size);
        return;
      }
    }
    throw new Error("QR render produced no image");
  } finally {
    try { holder.remove(); } catch (e) {}
  }
}

/** QR for any link / UPI. Optional center logo. */
async function tsMakeUniversalQrWithLogo(text, logoSrc){
  const size = 512;
  const qrCanvas = document.createElement("canvas");
  await tsDrawQrToCanvas(qrCanvas, String(text), { size: size });

  // Optional center logo (never fails the whole QR)
  if (logoSrc && typeof logoSrc === "string" && logoSrc.indexOf("data:") === 0) {
    try {
      const qctx = qrCanvas.getContext("2d");
      const logo = await new Promise(function(res, rej){
        const im = new Image();
        im.onload = function(){ res(im); };
        im.onerror = rej;
        im.src = logoSrc;
      });
      const ls = Math.floor(size * 0.18);
      const lx = (size - ls) / 2, ly = (size - ls) / 2;
      qctx.fillStyle = "#ffffff";
      qctx.fillRect(lx - 8, ly - 8, ls + 16, ls + 16);
      qctx.drawImage(logo, lx, ly, ls, ls);
    } catch (e) {}
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size + 28;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(qrCanvas, 0, 0);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, size, size, 28);
  ctx.fillStyle = "#64748b";
  ctx.font = "600 11px system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TechSerenia", size / 2, size + 18);
  return canvas.toDataURL("image/png");
}

document.getElementById("brandingForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("brandingMsg");
  const body = {
    brand_name: document.getElementById("bName").value.trim(),
    brand_tagline: document.getElementById("bTagline").value.trim(),
    brand_email: document.getElementById("bEmail").value.trim(),
    brand_phone: document.getElementById("bPhone").value.trim(),
    brand_address: document.getElementById("bAddress").value.trim(),
    accent_color: document.getElementById("bAccent").value,
    default_low_stock_limit: document.getElementById("bDefaultLimit").value || "5",
    footer_note: document.getElementById("bFooter").value.trim(),
    invoice_regulations: (document.getElementById("bRegulations") && document.getElementById("bRegulations").value.trim()) || "",
    show_techserenia_logo: document.getElementById("bShowTsLogo").checked ? "yes" : "no",
    show_orbitbills_branding: "yes",
  };
  if (document.getElementById("bUpiLink")) body.upi_link = document.getElementById("bUpiLink").value.trim();
  const upiPrev = document.getElementById("bUpiQrPreview");
  if (brandingCache.upi_qr_image && String(brandingCache.upi_qr_image).startsWith("data:")) {
    body.upi_qr_image = brandingCache.upi_qr_image;
  } else if (upiPrev && upiPrev.src && String(upiPrev.src).startsWith("data:")) {
    body.upi_qr_image = upiPrev.src;
  }
  if (brandingCache.qr_center_logo) body.qr_center_logo = brandingCache.qr_center_logo;
  else if (document.getElementById("bQrLogoPreview")?.src?.startsWith("data:")) {
    body.qr_center_logo = document.getElementById("bQrLogoPreview").src;
  }
  if (document.getElementById("bCurrency")) body.currency_symbol = document.getElementById("bCurrency").value.trim() || "₹";
  if (document.getElementById("bUpiId")) body.upi_id = document.getElementById("bUpiId").value.trim();
  if (document.getElementById("bUpiName")) body.upi_name = document.getElementById("bUpiName").value.trim();
  // Persist custom logo as data URL so invoice previews can show it offline
  const logoFile = document.getElementById("bLogo").files[0];
  if (logoFile) {
    body.custom_brand_logo = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(logoFile);
    });
  } else {
    // Keep existing custom logo if preview already shows a data URL or stored path
    const current = document.getElementById("bLogoPreview").src || "";
    if (current.startsWith("data:") || (brandingCache.custom_brand_logo && current.includes("data:"))) {
      body.custom_brand_logo = brandingCache.custom_brand_logo || current;
    }
  }
  const data = await api("/branding", { method: "POST", body });
  if (!data.ok) { msg.textContent = data.error || "Could not save branding."; msg.className = "msg error"; return; }
  msg.textContent = "Saved."; msg.className = "msg success";
  await initBranding();
  renderInvoicePreview();
});

function activeLayout(){
  const activeId = brandingCache.active_layout_id;
  return layoutsCache.find(l => String(l.id) === String(activeId)) || layoutsCache[0];
}

function renderLayoutCards(){
  const wrap = document.getElementById("layoutCards");
  wrap.innerHTML = layoutsCache.map(l => {
    const isSelected = String(l.id) === String(brandingCache.active_layout_id);
    const blocks = l.elements.map(el => `<div class="mini-block" style="left:${el.x/CANVAS_W*100}%;top:${el.y/CANVAS_H*100}%;width:${el.w/CANVAS_W*100}%;height:${el.h/CANVAS_H*100}%;"></div>`).join("");
    return `
      <div class="layout-card ${isSelected ? 'selected' : ''}" onclick="setActiveLayout(${l.id})">
        <div class="mini-canvas">${blocks}</div>
        <div class="layout-name">${escapeHtml(l.name)}</div>
        <div class="layout-tag">${l.is_preset ? 'Preset' : 'Custom'} · ${(PAPER_LAYOUT_SPECS[l.paper_size||l.paperSize||'a4']||{}).label||'A4'}</div>
      </div>`;
  }).join("");
}

async function setActiveLayout(id){
  const data = await api("/branding", { method: "POST", body: { active_layout_id: String(id) } });
  brandingCache.active_layout_id = String(id);
  renderLayoutCards();
  loadLayoutIntoDesigner(activeLayout());
  renderInvoicePreview();
}

function loadLayoutIntoDesigner(layout){
  if (!layout) return;
  designerElements = JSON.parse(JSON.stringify(layout.elements || []));
  designerSelectedId = null;
  document.getElementById("designerLayoutName").value = layout.name + (layout.is_preset ? " copy" : "");
  const ps = layout.paper_size || layout.paperSize || "a4";
  setDesignerPaperSize(ps);
  renderDesigner();
}

function renderDesigner(){
  const canvas = document.getElementById("designerCanvas");
  canvas.innerHTML = "";
  designerElements.forEach(el => {
    const block = document.createElement("div");
    block.className = "canvas-block" + (el.id === designerSelectedId ? " selected" : "");
    block.style.left = (el.x / CANVAS_W * 100) + "%";
    block.style.top = (el.y / CANVAS_H * 100) + "%";
    block.style.width = (el.w / CANVAS_W * 100) + "%";
    block.style.height = (el.h / CANVAS_H * 100) + "%";
    block.textContent = FIELD_LABELS[el.type] || el.type;
    block.addEventListener("pointerdown", ev => startDragBlock(ev, el));
    if (el.id === designerSelectedId) {
      const handle = document.createElement("div");
      handle.className = "resize-handle";
      handle.addEventListener("pointerdown", ev => { ev.stopPropagation(); startResizeBlock(ev, el); });
      block.appendChild(handle);
    }
    canvas.appendChild(block);
  });
  const fieldList = document.getElementById("designerFieldList");
  fieldList.innerHTML = designerElements.map(el => `
    <div class="field-row">
      <button type="button" class="field-pick ${el.id === designerSelectedId ? 'selected' : ''}" onclick="selectDesignerBlock('${el.id}')">${FIELD_LABELS[el.type] || el.type}</button>
      <button type="button" class="field-del" title="Remove from layout" onclick="removeDesignerBlock('${el.id}')">×</button>
    </div>
  `).join("");
}
function selectDesignerBlock(id){ designerSelectedId = id; renderDesigner(); }
function removeDesignerBlock(id){
  const el = designerElements.find(e => e.id === id);
  if (!el) return;
  if (!confirm("Remove “" + (FIELD_LABELS[el.type] || el.type) + "” from this layout?")) return;
  designerElements = designerElements.filter(e => e.id !== id);
  if (designerSelectedId === id) designerSelectedId = null;
  renderDesigner();
  renderInvoicePreview();
}
document.getElementById("btnAddLayoutBlock")?.addEventListener("click", () => {
  const type = document.getElementById("designerAddType")?.value || "logo";
  const id = type + "_" + Date.now().toString(36);
  const defaults = {
    logo: {x:30,y:30,w:90,h:90}, brand_name: {x:130,y:40,w:280,h:40}, brand_address: {x:130,y:80,w:280,h:50},
    invoice_meta: {x:440,y:40,w:130,h:80}, bill_to: {x:30,y:150,w:260,h:80}, items_table: {x:30,y:250,w:540,h:280},
    totals: {x:350,y:550,w:220,h:100}, footer_note: {x:30,y:700,w:540,h:40}, billing_notes: {x:30,y:640,w:540,h:40}, regulations: {x:30,y:740,w:540,h:50}, upi_qr: {x:420,y:620,w:120,h:120},
  };
  const d = defaults[type] || {x:40,y:40,w:120,h:60};
  designerElements.push({ id, type, ...d });
  designerSelectedId = id;
  renderDesigner();
  renderInvoicePreview();
});

function startDragBlock(ev, el){
  ev.preventDefault();
  designerSelectedId = el.id;
  renderDesigner();
  const canvas = document.getElementById("designerCanvas");
  const rect = canvas.getBoundingClientRect();
  const startX = ev.clientX, startY = ev.clientY;
  const origX = el.x, origY = el.y;
  function onMove(e){
    const dx = (e.clientX - startX) / rect.width * CANVAS_W;
    const dy = (e.clientY - startY) / rect.height * CANVAS_H;
    el.x = Math.max(0, Math.min(CANVAS_W - el.w, origX + dx));
    el.y = Math.max(0, Math.min(CANVAS_H - el.h, origY + dy));
    renderDesigner();
  }
  function onUp(){ document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); }
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

function startResizeBlock(ev, el){
  ev.preventDefault();
  const canvas = document.getElementById("designerCanvas");
  const rect = canvas.getBoundingClientRect();
  const startX = ev.clientX, startY = ev.clientY;
  const origW = el.w, origH = el.h;
  function onMove(e){
    const dw = (e.clientX - startX) / rect.width * CANVAS_W;
    const dh = (e.clientY - startY) / rect.height * CANVAS_H;
    el.w = Math.max(30, Math.min(CANVAS_W - el.x, origW + dw));
    el.h = Math.max(16, Math.min(CANVAS_H - el.y, origH + dh));
    renderDesigner();
  }
  function onUp(){ document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); }
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}


document.getElementById("paperSizeTabs")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".paper-size-tab");
  if (!btn) return;
  const size = btn.getAttribute("data-size");
  if (!size || size === designerPaperSize) return;
  const prevW = CANVAS_W, prevH = CANVAS_H;
  setDesignerPaperSize(size, { rescale: true, prevW, prevH });
});

document.getElementById("saveLayoutBtn").addEventListener("click", async () => {
  const msg = document.getElementById("designerMsg");
  const name = document.getElementById("designerLayoutName").value.trim() || "Custom layout";
  const data = await api("/invoice-layouts", { method: "POST", body: { name, elements: designerElements, paperSize: designerPaperSize } });
  if (!data.ok) { msg.textContent = data.error || "Could not save layout."; msg.className = "msg error"; return; }
  msg.textContent = "Saved as a new layout. Select it above to make it active."; msg.className = "msg success";
  const lData = await api("/invoice-layouts");
  if (lData.ok) layoutsCache = lData.layouts;
  renderLayoutCards();
});

function renderInvoicePreview(){
  const layout = activeLayout();
  const preview = document.getElementById("invoicePreview");
  if (!layout) { preview.innerHTML = '<p style="padding:20px;color:var(--slate);">No layout selected.</p>'; return; }
  const accent = document.getElementById("bAccent").value || "#0b3d91";
  const brandName = document.getElementById("bName").value || "TechSerenia";
  const tagline = document.getElementById("bTagline").value || "OrbitBills";
  const address = document.getElementById("bAddress").value || "123 Business Street, Surat, Gujarat";
  const footer = document.getElementById("bFooter").value || "Thank you for your business!";
  const logoSrc = document.getElementById("bLogoPreview").src;
  const showTs = document.getElementById("bShowTsLogo").checked;
  const showOrbit = true; // permanent OrbitBills watermark always on

  const sample = {
    items: [
      { name: "Basmati Rice 5kg", qty: 2, price: 650, tax: 12 },
      { name: "Paneer Tikka", qty: 1, price: 220, tax: 5 },
    ],
  };
  const subtotal = sample.items.reduce((s,i)=>s+i.qty*i.price,0);
  const tax = sample.items.reduce((s,i)=>s+i.qty*i.price*(i.tax/100),0);

  const blockHtml = { };
  const sourceEls = (designerElements && designerElements.length) ? designerElements : (layout.elements || []);
  sourceEls.forEach(el => {
    let inner = "";
    if (el.type === "logo") { const hasCustom = logoSrc && (logoSrc.startsWith("data:") || (logoSrc !== "logo.png" && logoSrc.indexOf("logo.png") < 0) || brandingCache.custom_brand_logo); inner = (showTs || hasCustom) ? `<img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'">` : ""; }
    else if (el.type === "brand_name") inner = `<div class="p-brand-name" style="color:${accent};">${escapeHtml(brandName)}</div><div style="font-size:10px;color:var(--slate);">${escapeHtml(tagline)}</div>`;
    else if (el.type === "brand_address") {
      const phone = (document.getElementById("bPhone") && document.getElementById("bPhone").value) || "";
      const email = (document.getElementById("bEmail") && document.getElementById("bEmail").value) || "";
      const contact = [phone, email].filter(Boolean).join(" · ");
      inner = `<div style="font-size:10px;color:var(--slate);white-space:pre-wrap;">${escapeHtml(address)}${contact ? "\n" + escapeHtml(contact) : ""}</div>`;
    }
    else if (el.type === "invoice_meta") inner = `<div style="font-size:10px;text-align:right;"><strong>INV-1001</strong><br>${formatIndiaTime(new Date())}</div>`;
    else if (el.type === "bill_to") inner = `<div style="font-size:10px;"><strong>Bill to</strong><br>Aditi Sharma<br>12 MG Road, Surat</div>`;
    else if (el.type === "items_table") inner = `
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="border-bottom:1px solid ${accent};"><th style="text-align:left;">Item</th><th>Qty</th><th>Price</th><th>Tax</th><th style="text-align:right;">Amount</th></tr></thead>
          <tbody>${sample.items.map(i => `<tr style="border-bottom:1px solid #eee;"><td>${i.name}</td><td style="text-align:center;">${i.qty}</td><td style="text-align:right;">${i.price.toFixed(2)}</td><td style="text-align:center;">${i.tax}%</td><td style="text-align:right;">${(i.qty*i.price).toFixed(2)}</td></tr>`).join("")}</tbody>
        </table>`;
    else if (el.type === "totals") inner = `
        <div style="font-size:11px;text-align:right;">
          <div>Subtotal: ${subtotal.toFixed(2)}</div>
          <div>Tax: ${tax.toFixed(2)}</div>
          <div style="font-weight:700;font-size:14px;color:${accent};margin-top:4px;">Total: ${(subtotal+tax).toFixed(2)}</div>
        </div>`;
    else if (el.type === "footer_note" || el.type === "footer") inner = `<div style="font-size:10px;color:var(--slate);white-space:pre-wrap;">${escapeHtml(footer)}</div>`;
      else if (el.type === "billing_notes") inner = inv.notes ? `<div style="font-size:10px;"><strong>Notes</strong><br>${escapeHtml(inv.notes)}</div>` : "";
    else if (el.type === "billing_notes") inner = `<div style="font-size:10px;"><strong>Notes</strong><br><span style="color:var(--slate)">Cashier notes from billing…</span></div>`;
    else if (el.type === "regulations") {
      const regs = (document.getElementById("bRegulations") && document.getElementById("bRegulations").value) || brandingCache.invoice_regulations || "";
      inner = `<div style="font-size:9px;color:var(--slate);white-space:pre-wrap;line-height:1.35;">${escapeHtml(regs)}</div>`;
    }
    else if (el.type === "orbitbills_badge") inner = `<div class="p-orbit"><img src="logo.png" onerror="this.style.display='none'">Powered by OrbitBills &middot; TechSerenia</div>`;
    else if (el.type === "upi_qr") {
      let qr = brandingCache.upi_qr_image || "";
      const prevEl = document.getElementById("bUpiQrPreview");
      if ((!qr || !String(qr).startsWith("data:")) && prevEl && prevEl.src && String(prevEl.src).startsWith("data:")) qr = prevEl.src;
      inner = (qr && String(qr).startsWith("data:"))
        ? `<img src="${qr}" style="width:100%;height:100%;object-fit:contain;background:#fff" alt="Payment QR">`
        : `<div style="font-size:9px;color:var(--slate);border:1px dashed var(--border);height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px">Payment QR<br>(generate or upload, then Save branding)</div>`;
    }
    blockHtml[el.id] = inner;
  });

  // Always pin permanent watermark bottom-left (not in elements list — cannot be deleted)
  const wmTop = Math.max(0, CANVAS_H - 28);
  const wmW = Math.min(280, CANVAS_W - 24);
  const wm = `<div class="p-block" style="left:12px;top:${wmTop}px;width:${wmW}px;height:28px;pointer-events:none;">
    <div style="font-size:9px;color:#64748b;font-weight:600;letter-spacing:.02em;">Powered By OrbitBills by TechSerenia</div>
  </div>`;

  const spec = PAPER_LAYOUT_SPECS[designerPaperSize] || PAPER_LAYOUT_SPECS.a4;
  preview.className = "invoice-preview " + (spec.cssClass || "");
  preview.style.width = CANVAS_W + "px";
  preview.style.height = CANVAS_H + "px";

  const els = (designerElements && designerElements.length) ? designerElements : (layout.elements || []);
  // Build blockHtml for designer elements that might not be on saved layout yet
  els.forEach(el => {
    if (blockHtml[el.id] != null) return;
    let inner = "";
    if (el.type === "upi_qr") {
      let qr = brandingCache.upi_qr_image || "";
      const prevEl = document.getElementById("bUpiQrPreview");
      if ((!qr || !String(qr).startsWith("data:")) && prevEl && prevEl.src && String(prevEl.src).startsWith("data:")) qr = prevEl.src;
      inner = (qr && String(qr).startsWith("data:"))
        ? `<img src="${qr}" style="width:100%;height:100%;object-fit:contain;background:#fff" alt="Payment QR">`
        : `<div style="font-size:9px;color:var(--slate);border:1px dashed var(--border);height:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px">Payment QR</div>`;
    } else {
      inner = `<div style="font-size:10px;color:var(--slate)">${FIELD_LABELS[el.type]||el.type}</div>`;
    }
    blockHtml[el.id] = inner;
  });

  preview.innerHTML = els.map(el => `
    <div class="p-block p-${(el.type||"").replace(/_/g,'-')}" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;">
      ${blockHtml[el.id] || ""}
    </div>
  `).join("") + wm;
}
["bAddress","bFooter","bRegulations","bShowTsLogo","bPhone","bEmail","bTagline"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderInvoicePreview);
  document.getElementById(id).addEventListener("change", renderInvoicePreview);
});

// =========================================================================
// USERS
// =========================================================================
async function renderUsers(){
  const msg = document.getElementById("usersMsg");
  msg.textContent = "";
  const data = await api("/users");
  if (!data.ok) { msg.textContent = data.error || "Could not load users."; msg.className = "msg error"; return; }
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = data.users.map(u => `
    <tr>
      <td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td><span class="pill retail">${escapeHtml(u.role)}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openPasswordReset(${u.id}, '${escapeHtml(u.name).replace(/'/g,"\\'")}')">Reset password</button>
        <button class="btn btn-ghost btn-sm" onclick="openRoleChange(${u.id}, '${escapeHtml(u.name).replace(/'/g,"\\'")}', '${escapeHtml(u.role)}')">Change role</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Delete</button>
      </td>
    </tr>
  `).join("");
  document.getElementById("usersEmpty").style.display = data.users.length ? "none" : "block";
}

// =========================================================================
// SESSIONS
// =========================================================================
function tsDeviceLabel(ua){
  ua = ua || "";
  let browser = "Unknown browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  let os = "";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "Mac";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return os ? `${browser} · ${os}` : browser;
}
async function renderSessions(){
  const msg = document.getElementById("sessionsMsg");
  if (msg) { msg.textContent = ""; msg.className = "msg"; }
  const data = await api("/sessions?history=1");
  if (!data.ok) {
    if (msg) { msg.textContent = data.error || "Could not load sessions."; msg.className = "msg error"; }
    return;
  }
  const tbody = document.getElementById("sessionsTableBody");
  const sessions = data.sessions || [];
  const fmt = (typeof formatIndiaTime === "function") ? formatIndiaTime : (x => x || "");
  if (tbody) {
    tbody.innerHTML = sessions.map(s => `
      <tr>
        <td>${escapeHtml(s.email||"")}${s.is_current ? ' <span class="pill paid">This device</span>' : ''}</td>
        <td><span class="pill retail">${escapeHtml(s.role||"")}</span></td>
        <td>${escapeHtml(typeof tsDeviceLabel === "function" ? tsDeviceLabel(s.user_agent) : (s.user_agent||""))}</td>
        <td>${escapeHtml(s.ip_address || "local")}</td>
        <td>${escapeHtml(fmt(s.created_at))}</td>
        <td>${escapeHtml(s.last_active_relative || fmt(s.last_active_at) || "")}</td>
        <td>${s.is_current ? "—" : `<button class="btn btn-danger btn-sm" type="button" onclick="revokeSession('${String(s.id).replace(/'/g,"")}')">Sign out</button>`}</td>
      </tr>
    `).join("") || "";
  }
  const empty = document.getElementById("sessionsEmpty");
  if (empty) empty.style.display = sessions.length ? "none" : "block";

  // Optional history block
  let histBox = document.getElementById("sessionsHistoryBody");
  if (!histBox) {
    const card = document.querySelector("#panel-sessions .card");
    if (card) {
      const wrap = document.createElement("div");
      wrap.style.marginTop = "18px";
      wrap.innerHTML = `<h3 style="font-size:15px;margin-bottom:8px">Session history</h3>
        <div class="table-scroll"><table><thead><tr>
          <th>Account</th><th>Role</th><th>Signed in</th><th>Status</th>
        </tr></thead><tbody id="sessionsHistoryBody"></tbody></table></div>`;
      card.appendChild(wrap);
      histBox = document.getElementById("sessionsHistoryBody");
    }
  }
  if (histBox) {
    const hist = data.history || [];
    histBox.innerHTML = hist.length
      ? hist.map(s => `<tr>
          <td>${escapeHtml(s.email||"")}</td>
          <td>${escapeHtml(s.role||"")}</td>
          <td>${escapeHtml(fmt(s.created_at))}</td>
          <td><span class="pill unpaid">Ended</span></td>
        </tr>`).join("")
      : `<tr><td colspan="4" style="color:var(--slate)">No past sessions yet. Sign out and sign in again to build history.</td></tr>`;
  }
}
async function revokeSession(id){
  if (!confirm("Sign this session out?")) return;
  const data = await api(`/sessions/${id}/revoke`, { method: "POST" });
  if (!data.ok) { alert(data.error || "Could not revoke session."); return; }
  renderSessions();
}
document.getElementById("revokeOtherSessionsBtn")?.addEventListener("click", async () => {
  if (!confirm("Sign out every other device? You'll stay signed in here.")) return;
  const data = await api("/sessions/revoke-others", { method: "POST" });
  if (!data.ok) { alert(data.error || "Failed."); return; }
  renderSessions();
});

document.getElementById("openAddUser").addEventListener("click", () => {
  document.getElementById("userForm").reset();
  document.getElementById("userFormMsg").textContent = "";
  openModal("userModal");
});

async function deleteUser(id){
  if (!confirm("Delete this user account?")) return;
  const data = await api(`/users/${id}`, { method: "DELETE" });
  if (data.ok) renderUsers();
  else alert(data.error || "Could not delete user.");
}

function openPasswordReset(id, name){
  document.getElementById("pwUserId").value = id;
  document.getElementById("pwUserLabel").textContent = `Setting a new password for ${name}.`;
  document.getElementById("passwordForm").reset();
  document.getElementById("passwordFormMsg").textContent = "";
  openModal("passwordModal");
}

document.getElementById("passwordForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("passwordFormMsg");
  const id = document.getElementById("pwUserId").value;
  const data = await api(`/users/${id}/password`, { method: "POST", body: { password: document.getElementById("pwNew").value } });
  if (!data.ok) { msg.textContent = data.error || "Could not reset password."; msg.className = "msg error"; return; }
  closeModal("passwordModal");
});

document.getElementById("userForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("userFormMsg");
  const payload = {
    name: document.getElementById("uName").value.trim(),
    email: document.getElementById("uEmail").value.trim(),
    password: document.getElementById("uPassword").value,
    role: document.getElementById("uRole").value,
  };
  const data = await api("/users", { method: "POST", body: payload });
  if (!data.ok) { msg.textContent = data.error || "Could not create user."; msg.className = "msg error"; return; }
  closeModal("userModal");
  renderUsers();
});

// =========================================================================
// CSV / Excel IMPORT (IndexedDB via tsLocalApi)
// =========================================================================
function normHeaderRow(row){
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = String(k || "").trim().replace(/^\uFEFF/, "");
    out[key] = v;
    const low = key.toLowerCase().replace(/[\s_]+/g, "");
    if (low === "costprice" || low === "cost") out.cost = out.cost ?? v;
    if (low === "taxslab" || low === "taxslabid" || low === "tax") out.taxSlab = out.taxSlab ?? v;
    if (low === "taxpercent" || low === "taxpercentage" || low === "gst") out.taxPercent = out.taxPercent ?? v;
    if (low === "lowstocklimit" || low === "lowstock") out.lowStockLimit = out.lowStockLimit ?? v;
    if (low === "hsn" || low === "hsncode" || low === "sac") out.hsnCode = out.hsnCode ?? v;
    if (low === "storetype" || low === "type") out.storeType = out.storeType ?? v;
    if (low === "expiry" || low === "expirydate") out.expiryDate = out.expiryDate ?? v;
  }
  return out;
}

async function readCsv(file){
  if (typeof Papa === "undefined" && window.__orbitEnsurePapa) await window.__orbitEnsurePapa();
  return new Promise((resolve, reject) => {
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: r => resolve((r.data || []).map(normHeaderRow)), error: reject });
  });
}

async function readSpreadsheet(file){
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".csv") || (file.type || "").includes("csv") || (file.type || "").includes("text/")) {
    return readCsv(file);
  }
  if (typeof XLSX === "undefined" && window.__orbitEnsureXlsx) await window.__orbitEnsureXlsx();
  if (typeof XLSX === "undefined") throw new Error("Excel library not loaded. Use CSV or check your network for SheetJS.");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows.map(normHeaderRow);
}

async function resolveTaxSlabId(row){
  await loadTaxSlabsCache();
  const rawSlab = row.taxSlab != null && row.taxSlab !== "" ? String(row.taxSlab).trim() : "";
  const rawPct = row.taxPercent != null && row.taxPercent !== "" ? String(row.taxPercent).trim() : "";
  if (rawSlab) {
    if (/^\d+$/.test(rawSlab)) {
      const id = parseInt(rawSlab, 10);
      if (taxSlabsCache.some(t => Number(t.id) === id)) return id;
    }
    const byName = taxSlabsCache.find(t => String(t.name || "").toLowerCase() === rawSlab.toLowerCase());
    if (byName) return byName.id;
    const pctMatch = rawSlab.match(/(\d+(?:\.\d+)?)\s*%?/);
    if (pctMatch) {
      const pct = parseFloat(pctMatch[1]);
      const byPct = taxSlabsCache.find(t => Number(t.percentage) === pct);
      if (byPct) return byPct.id;
    }
  }
  if (rawPct) {
    const pct = parseFloat(String(rawPct).replace("%", ""));
    if (!Number.isNaN(pct)) {
      const byPct = taxSlabsCache.find(t => Number(t.percentage) === pct);
      if (byPct) return byPct.id;
    }
  }
  return null;
}

document.getElementById("clientsCsvBtn").addEventListener("click", async () => {
  const input = document.getElementById("clientsCsvInput");
  const msg = document.getElementById("clientsCsvMsg");
  if (!input.files.length) { msg.textContent = "Choose a CSV or Excel file first."; msg.className = "msg error"; return; }
  try {
    msg.textContent = "Importing…"; msg.className = "msg";
    const rows = await readSpreadsheet(input.files[0]);
    let count = 0;
    for (const row of rows) {
      const name = String(row.name || "").trim();
      if (!name) continue;
      const data = await api("/clients", { method: "POST", body: {
        name, email: String(row.email||"").trim(), phone: String(row.phone||"").trim(),
        address: String(row.address||"").trim(), gstin: String(row.gstin||"").trim(), notes: String(row.notes||"").trim(),
      }});
      if (data.ok) count++;
    }
    msg.textContent = `Imported ${count} client(s).`; msg.className = "msg success";
    renderClients();
    renderOverview();
  } catch (err) {
    console.error(err);
    msg.textContent = "Could not read that file. Use CSV or .xlsx with a header row."; msg.className = "msg error";
  }
});

document.getElementById("productsCsvBtn").addEventListener("click", async () => {
  const input = document.getElementById("productsCsvInput");
  const msg = document.getElementById("productsCsvMsg");
  if (!input.files.length) { msg.textContent = "Choose a CSV or Excel file first."; msg.className = "msg error"; return; }
  try {
    msg.textContent = "Importing…"; msg.className = "msg";
    const rows = await readSpreadsheet(input.files[0]);
    let count = 0;
    for (const row of rows) {
      const name = String(row.name || "").trim();
      if (!name) continue;
      const stRaw = String(row.storeType || row.store_type || "other").toLowerCase();
      const storeType = ["grocery","restaurant","retail","other"].includes(stRaw) ? stRaw : "other";
      const taxSlabId = await resolveTaxSlabId(row);
      const taxInclRaw = String(row.priceIncludesTax || row.price_includes_tax || row.taxInclusive || row.tax_inclusive || row.mrp || "").toLowerCase();
      const priceIncludesTax = ["1","yes","true","y","mrp","inclusive"].includes(taxInclRaw) || taxInclRaw === "1";
      const body = {
        name,
        brand: String(row.brand || "").trim(),
        storeType,
        category: String(row.category || "").trim(),
        unit: String(row.unit || "pcs").trim() || "pcs",
        price: parseFloat(row.price != null ? row.price : (row.mrp || 0)) || 0,
        priceIncludesTax,
        costPrice: parseFloat(row.cost != null ? row.cost : (row.costPrice || row.cost_price || 0)) || 0,
        stock: parseFloat(row.stock) || 0,
        sku: String(row.sku || "").trim(),
        barcode: String(row.barcode || "").trim(),
        hsnCode: String(row.hsnCode || row.hsn_code || "").trim(),
        notes: String(row.notes || "").trim(),
        expiryDate: String(row.expiryDate || row.expiry_date || "").trim(),
      };
      if (row.lowStockLimit != null && row.lowStockLimit !== "") body.lowStockLimit = parseInt(row.lowStockLimit, 10);
      if (taxSlabId != null) body.taxSlabId = taxSlabId;
      const data = await api("/products", { method: "POST", body });
      if (data.ok) count++;
    }
    msg.textContent = `Imported ${count} product(s).`; msg.className = "msg success";
    renderProducts();
    renderOverview();
  } catch (err) {
    console.error(err);
    msg.textContent = "Could not read that file. Use CSV or .xlsx with a header row."; msg.className = "msg error";
  }
});

// =========================================================================
// Sign out + auth gate
// =========================================================================
const signOutBtn = document.getElementById("signOutBtn");
if (signOutBtn) {
  signOutBtn.addEventListener("click", async () => {
    try { tsLogout(); } catch (e) {}
    window.location.href = "signin.html";
  });
}

// =========================================================================
// IndexedDB SMTP settings
// =========================================================================
const IDB_NAME = "orbitbills_admin";
const IDB_STORE = "settings";
function idbOpen(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, value){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbDel(key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSmtpForm(){
  // Prefer main OrbitBills IndexedDB settings, fall back to legacy orbitbills_admin
  let smtp = {};
  try {
    const all = await tsGetAllSettings();
    if (all.smtp_user || all.smtp_json) {
      if (all.smtp_json) { try { smtp = JSON.parse(all.smtp_json); } catch(e) {} }
      smtp.user = smtp.user || all.smtp_user || "";
      smtp.password = smtp.password || all.smtp_pass || "";
      smtp.host = smtp.host || all.smtp_host || "";
      smtp.port = smtp.port || all.smtp_port || 587;
      smtp.fromName = smtp.fromName || all.smtp_from_name || "";
    }
  } catch (e) {}
  if (!smtp.user) {
    try { smtp = (await idbGet("smtp")) || {}; } catch (e) {}
  }
  const el = (id) => document.getElementById(id);
  if (!el("smtpUser")) return;
  el("smtpUser").value = smtp.user || smtp.fromEmail || "";
  el("smtpPass").value = smtp.password || "";
  el("smtpHost").value = smtp.host || "smtp.gmail.com";
  el("smtpPort").value = smtp.port || 587;
  if (el("smtpFrom")) el("smtpFrom").value = smtp.fromName || "";
  if (el("smtpSecure")) el("smtpSecure").value = smtp.secure || "starttls";
}
function readSmtpForm(){
  const user = document.getElementById("smtpUser").value.trim();
  const pass = document.getElementById("smtpPass").value;
  let host = (document.getElementById("smtpHost") && document.getElementById("smtpHost").value.trim()) || "";
  let port = parseInt((document.getElementById("smtpPort") && document.getElementById("smtpPort").value) || "587", 10);
  const fromName = (document.getElementById("smtpFrom") && document.getElementById("smtpFrom").value.trim()) || "";
  const secure = (document.getElementById("smtpSecure") && document.getElementById("smtpSecure").value) || "starttls";
  // Auto Gmail / Outlook / Yahoo host if blank
  if (!host && user) {
    const domain = user.split("@")[1] || "";
    if (/gmail\.com$/i.test(domain) || /googlemail\.com$/i.test(domain)) host = "smtp.gmail.com";
    else if (/outlook\.|hotmail\.|live\./i.test(domain)) host = "smtp.office365.com";
    else if (/yahoo\./i.test(domain)) host = "smtp.mail.yahoo.com";
    else host = "smtp." + domain;
  }
  if (!host) host = "smtp.gmail.com";
  return { user, password: pass, host, port, fromEmail: user, fromName: fromName || user, secure, useTls: secure !== "none" };
}
document.getElementById("smtpForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("smtpMsg");
  const smtp = readSmtpForm();
  if (!smtp.user || !smtp.password) {
    msg.textContent = "Enter your email and app password."; msg.className = "msg error"; return;
  }
  msg.textContent = "Saving…"; msg.className = "msg";
  try {
    await idbSet("smtp", smtp);
    // Also store in main IndexedDB settings store (strict local-first)
    await tsSetSetting("smtp_json", JSON.stringify(smtp));
    await tsSetSetting("smtp_user", smtp.user);
    await tsSetSetting("smtp_host", smtp.host);
    await tsSetSetting("smtp_from_name", smtp.fromName || "");
    msg.textContent = "Saved on this device."; msg.className = "msg success";
  } catch (err) {
    msg.textContent = "Could not save: " + (err.message || err); msg.className = "msg error";
  }
});
document.getElementById("btnSendEmail")?.addEventListener("click", async () => {
  const msg = document.getElementById("emailSendMsg");
  const to = (document.getElementById("emailTo") && document.getElementById("emailTo").value.trim()) || "";
  const subject = (document.getElementById("emailSubject") && document.getElementById("emailSubject").value.trim()) || "";
  const body = (document.getElementById("emailBody") && document.getElementById("emailBody").value) || "";
  if (!to) { msg.textContent = "Enter a recipient email."; msg.className = "msg error"; return; }
  let smtp = readSmtpForm();
  if (!smtp.user || !smtp.password) {
    try {
      const all = await tsGetAllSettings();
      if (all.smtp_json) smtp = { ...smtp, ...JSON.parse(all.smtp_json) };
    } catch (e) {}
  }
  if (!smtp.user || !smtp.password) {
    msg.textContent = "Save your email + app password first."; msg.className = "msg error"; return;
  }
  msg.textContent = "Sending…"; msg.className = "msg";
  // Try local API (no-op offline) then fall back to mailto so the user can still send
  try {
    const data = await api("/email/send", { method: "POST", body: { smtp, to, subject, body, html: false } });
    if (data && data.ok) {
      msg.textContent = "Email sent."; msg.className = "msg success"; return;
    }
  } catch (e) {}
  // Offline-friendly: open mail client with pre-filled message
  const mailto = "mailto:" + encodeURIComponent(to)
    + "?subject=" + encodeURIComponent(subject)
    + "&body=" + encodeURIComponent(body);
  window.open(mailto, "_blank");
  msg.textContent = "Opened your mail app with this message. (Local-first: server send is optional.)";
  msg.className = "msg success";
});
document.getElementById("btnFillClientEmails")?.addEventListener("click", async () => {
  const list = document.getElementById("clientEmailList");
  if (!list) return;
  const d = await api("/clients");
  const emails = (d.clients || []).map(c => c.email).filter(Boolean);
  list.innerHTML = emails.map(e => `<option value="${escapeHtml(e)}">`).join("");
  const msg = document.getElementById("emailSendMsg");
  if (msg) { msg.textContent = emails.length ? (emails.length + " client email(s) loaded.") : "No client emails on file."; msg.className = "msg"; }
});
loadSmtpForm();

// India clock in sidebar
function formatAdminIndiaClock(){
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short", day: "2-digit", month: "short",
      hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
    }).format(new Date());
  } catch (e) { return ""; }
}
function tickAdminClock(){
  const el = document.getElementById("adminIndiaClock");
  if (el) el.textContent = formatAdminIndiaClock();
}
setInterval(tickAdminClock, 1000);
setTimeout(tickAdminClock, 0);

function formatIndiaTime(d){
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(d ? new Date(d) : new Date());
  } catch (e) { return ""; }
}


// =========================================================================
// Native file save (Android Downloads / Files) + system share
// =========================================================================
async function orbitBlobToBase64(blob){
  return await new Promise(function(resolve, reject){
    var r = new FileReader();
    r.onload = function(){
      var s = String(r.result || "");
      var i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
function orbitIsNative(){
  try{ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  catch(e){ return false; }
}
function orbitPlugin(name){
  try{ return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]; }
  catch(e){ return null; }
}
/** Save blob to device Downloads/Documents and optionally open system share (WhatsApp, Drive, etc.) */
async function orbitSaveFile(blob, filename, opts){
  opts = opts || {};
  filename = filename || ("orbitbills-" + Date.now());
  var mime = (blob && blob.type) || opts.mime || "application/octet-stream";
  var savedPath = null;
  var shared = false;
  try{
    if(orbitIsNative()){
      var FS = orbitPlugin("Filesystem");
      var Share = orbitPlugin("Share");
      if(FS && FS.writeFile){
        var b64 = await orbitBlobToBase64(blob);
        var path = "Download/" + filename;
        var dirs = ["EXTERNAL_STORAGE", "DOCUMENTS", "CACHE", "DATA"];
        // Capacitor uses enum values on plugin: Directory.ExternalStorage etc.
        var dirMap = {
          EXTERNAL_STORAGE: "EXTERNAL",
          DOCUMENTS: "DOCUMENTS",
          CACHE: "CACHE",
          DATA: "DATA"
        };
        var written = false;
        var tryDirs = ["EXTERNAL", "DOCUMENTS", "CACHE"];
        for(var d = 0; d < tryDirs.length && !written; d++){
          try{
            await FS.writeFile({ path: path, data: b64, directory: tryDirs[d], recursive: true });
            written = true;
            var uriRes = await FS.getUri({ path: path, directory: tryDirs[d] });
            savedPath = (uriRes && (uriRes.uri || uriRes)) || path;
          }catch(eDir){
            // try without Download/ prefix
            try{
              await FS.writeFile({ path: filename, data: b64, directory: tryDirs[d], recursive: true });
              written = true;
              var uriRes2 = await FS.getUri({ path: filename, directory: tryDirs[d] });
              savedPath = (uriRes2 && (uriRes2.uri || uriRes2)) || filename;
            }catch(e2){}
          }
        }
        if(written && opts.share !== false && Share && Share.share && savedPath){
          try{
            // files[] required so WhatsApp/Drive get the CSV/Excel attachment
            await Share.share({
              title: opts.title || filename,
              text: opts.text || ("Export from TechSerenia"),
              url: savedPath,
              files: [savedPath],
              dialogTitle: opts.dialogTitle || "Save or share"
            });
            shared = true;
          }catch(eShare){
            try{
              await Share.share({
                title: opts.title || filename,
                text: opts.text || ("Export from TechSerenia"),
                url: savedPath,
                dialogTitle: opts.dialogTitle || "Save or share"
              });
              shared = true;
            }catch(e2){ console.warn("Share", e2); }
          }
        }
        // Also try unified helper (same path as invoice share)
        if(!shared && opts.share !== false && window.__orbitNativeShare){
          try{
            shared = !!(await window.__orbitNativeShare({
              blob: blob,
              filename: filename,
              title: opts.title || filename,
              text: opts.text || "Export from TechSerenia"
            }));
          }catch(eH){}
        }
        if(written){
          return { ok: true, path: savedPath, shared: shared, native: true };
        }
      }
      // Fallback: Share with object URL may not work on native; still try web path below
    }
  }catch(eNat){ console.warn("orbitSaveFile native", eNat); }

  // Web / browser download (Chrome on Android saves to Downloads)
  try{
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ try{ URL.revokeObjectURL(url); a.remove(); }catch(e){} }, 1500);
    // Also offer system share if available (Android Chrome)
    if(opts.share && navigator.share && navigator.canShare){
      try{
        var file = new File([blob], filename, { type: mime });
        if(navigator.canShare({ files: [file] })){
          await navigator.share({ files: [file], title: opts.title || filename, text: opts.text || "" });
          shared = true;
        }
      }catch(eW){ if(!(eW && eW.name === "AbortError")) console.warn(eW); }
    }
    return { ok: true, path: "Downloads/" + filename, shared: shared, native: false };
  }catch(eWeb){
    console.error(eWeb);
    return { ok: false, error: eWeb.message || String(eWeb) };
  }
}

function orbitPaperSize(layout){
  var key = (layout && (layout.paper_size || layout.paperSize || layout.size)) || "a4";
  key = String(key).toLowerCase();
  var map = {
    a4: { w: 600, h: 848, label: "A4" },
    a5: { w: 420, h: 595, label: "A5" },
    letter: { w: 612, h: 792, label: "Letter" },
    thermal80: { w: 302, h: 800, label: "Thermal 80mm" },
    thermal58: { w: 220, h: 700, label: "Thermal 58mm" }
  };
  return map[key] || map.a4;
}

function orbitScaleInvoicePreview(){
  var canvas = document.getElementById("viewInvoiceCanvas");
  var wrap = document.getElementById("viewInvoiceScaleWrap");
  var outer = document.querySelector("#viewInvoiceModal .invoice-preview-outer");
  if(!canvas || !outer) return;
  var designW = parseFloat(canvas.getAttribute("data-design-w") || canvas.offsetWidth || 600) || 600;
  var designH = parseFloat(canvas.getAttribute("data-design-h") || canvas.offsetHeight || 848) || 848;
  // Fixed design size
  canvas.style.width = designW + "px";
  canvas.style.height = designH + "px";
  canvas.style.maxWidth = "none";
  var avail = Math.max(120, outer.clientWidth - 24);
  var scale = Math.min(1, avail / designW);
  var target = wrap || canvas;
  if(wrap){
    wrap.style.width = designW + "px";
    wrap.style.height = designH + "px";
    wrap.style.transform = "scale(" + scale + ")";
    wrap.style.transformOrigin = "top center";
    outer.style.height = Math.ceil(designH * scale + 16) + "px";
  } else {
    canvas.style.transform = "scale(" + scale + ")";
    canvas.style.transformOrigin = "top center";
    outer.style.height = Math.ceil(designH * scale + 16) + "px";
  }
}

async function orbitShareInvoiceSocial(inv){
  if(!inv){ alert("Open an invoice first"); return; }
  var title = "Invoice " + (inv.invoice_number || inv.id || "");
  var text = title + "\\n" + (inv.client_name || "Walk-in") + "\\nTotal: " + money(inv.total) + "\\nStatus: " + (inv.status || "");
  // Try capture preview as PNG for Instagram / WhatsApp
  var blob = null;
  try{
    var canvasEl = document.getElementById("viewInvoiceCanvas");
    if(canvasEl && window.html2canvas){
      var shot = await html2canvas(canvasEl, { scale: 2, backgroundColor: "#ffffff" });
      blob = await new Promise(function(res){ shot.toBlob(res, "image/png"); });
    }
  }catch(e){}
  // Simple canvas draw fallback: not available without html2canvas — share text
  var filename = "invoice-" + String(inv.invoice_number || inv.id || "doc").replace(/[^a-zA-Z0-9_-]/g, "_") + ".png";
  if(blob){
    var r = await orbitSaveFile(blob, filename, {
      share: true,
      title: title,
      text: text,
      mime: "image/png",
      dialogTitle: "Share invoice"
    });
    if(r && r.ok) return;
  }
  // Text / system share
  if(navigator.share){
    try{ await navigator.share({ title: title, text: text }); return; }catch(e){ if(e && e.name==="AbortError") return; }
  }
  if(window.__orbitNativeShare){
    try{
      // share text-only via native if no blob
      await navigator.share({ title: title, text: text });
      return;
    }catch(e){}
  }
  // WhatsApp deep link as last resort
  var wa = "https://wa.me/?text=" + encodeURIComponent(text);
  window.open(wa, "_blank");
}


// =========================================================================
// Backup / restore
// =========================================================================

document.getElementById("btnExportProductsCsv")?.addEventListener("click", async function(){
  try{
    const rows = productsCache || [];
    const header = ["name","brand","category","unit","price","cost","stock","sku","barcode","hsn"];
    const lines = [header.join(",")];
    rows.forEach(p => {
      lines.push([p.name,p.brand,p.category,p.unit,p.price,p.cost,p.stock,p.sku,p.barcode,p.hsn_code]
        .map(v => '"' + String(v??"").replace(/"/g,'""') + '"').join(","));
    });
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const filename = "products-" + new Date().toISOString().slice(0,10) + ".csv";
    await orbitSaveFile(blob, filename, { share:true, title:"Products CSV", mime:"text/csv", dialogTitle:"Save products CSV" });
  }catch(e){ alert("Export failed"); }
});
document.getElementById("btnExportClientsCsv")?.addEventListener("click", async function(){
  try{
    const rows = clientsCache || [];
    const header = ["name","email","phone","credit_balance"];
    const lines = [header.join(",")];
    rows.forEach(c => {
      lines.push([c.name,c.email,c.phone,c.credit_balance]
        .map(v => '"' + String(v??"").replace(/"/g,'""') + '"').join(","));
    });
    const blob = new Blob([lines.join("\n")], {type:"text/csv;charset=utf-8"});
    const filename = "clients-" + new Date().toISOString().slice(0,10) + ".csv";
    await orbitSaveFile(blob, filename, { share:true, title:"Clients CSV", mime:"text/csv", dialogTitle:"Save clients CSV" });
  }catch(e){ alert("Export failed"); }
});

(function wireBackup(){
  const createBtn = document.getElementById("createBackupBtn");
  if (!createBtn) return;
  createBtn.addEventListener("click", async () => {
    const msg = document.getElementById("backupMsg");
    msg.textContent = "Preparing backup from this device..."; msg.className = "msg";
    try {
      if (!(typeof tsWhoami === "function" && tsWhoami().ok)) {
        msg.textContent = "Sign-in required."; msg.className = "msg error"; return;
      }
      // Build ZIP blob then save to Android Downloads / share sheet
      const payload = await tsBuildBackupPayload();
      const json = JSON.stringify(payload, null, 2);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const innerName = "orbitbills-backup-" + stamp + ".json";
      const filename = "orbitbills-backup-" + stamp + ".zip";
      const blob = typeof tsZipSingleFile === "function" ? tsZipSingleFile(innerName, json) : new Blob([json], {type:"application/json"});
      const result = await orbitSaveFile(blob, filename, {
        share: true,
        title: "OrbitBills backup",
        text: "OrbitBills backup " + stamp,
        mime: blob.type || "application/zip",
        dialogTitle: "Save backup to Files / Drive"
      });
      if(result && result.ok){
        var st = payload.stats || {};
        var extra = " · products " + (st.products||0) +
          ", photos " + (st.productPhotos||0) +
          ", layouts " + (st.invoiceLayouts||0) +
          ", invoices " + (st.invoices||0);
        msg.textContent = (result.native
          ? ("Saved — use the share sheet for Downloads/Files (" + filename + ")")
          : ("Downloaded to Downloads (" + filename + ")")) + extra;
        msg.className = "msg success";
      } else {
        // last resort: original helper
        const r2 = await tsDownloadBackupZip();
        msg.textContent = "Backup ZIP downloaded" + (r2.filename ? " (" + r2.filename + ")" : "") + ".";
        msg.className = "msg success";
      }
    } catch (e) {
      console.error(e);
      msg.textContent = "Backup failed: " + (e.message || e); msg.className = "msg error";
    }
  });

  document.getElementById("createBackupJsonBtn")?.addEventListener("click", async () => {
    const msg = document.getElementById("backupMsg");
    msg.textContent = "Preparing JSON backup..."; msg.className = "msg";
    try {
      const payload = await tsBuildBackupPayload();
      const json = JSON.stringify(payload, null, 2);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const filename = "orbitbills-backup-" + stamp + ".json";
      const blob = new Blob([json], { type: "application/json" });
      const result = await orbitSaveFile(blob, filename, { share: true, title: "OrbitBills backup JSON", mime: "application/json", dialogTitle: "Save JSON backup" });
      msg.textContent = (result && result.ok ? "JSON backup saved (" + filename + ")" : "JSON backup ready") + ".";
      msg.className = "msg success";
    } catch (e) {
      msg.textContent = "JSON backup failed: " + (e.message || e); msg.className = "msg error";
    }
  });
  async function saveSheetCsv(store, filenamePrefix) {
    const msg = document.getElementById("backupMsg");
    msg.textContent = "Exporting " + store + "..."; msg.className = "msg";
    const csv = typeof tsExportStoreCsv === "function" ? await tsExportStoreCsv(store) : "";
    const filename = filenamePrefix + "-" + new Date().toISOString().slice(0,10) + ".csv";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    await orbitSaveFile(blob, filename, { share: true, title: filenamePrefix, mime: "text/csv", dialogTitle: "Save CSV" });
    msg.textContent = "Exported " + filename; msg.className = "msg success";
  }
  document.getElementById("exportProductsCsvBackupBtn")?.addEventListener("click", () => saveSheetCsv("products", "products").catch(e => {
    document.getElementById("backupMsg").textContent = "Export failed: " + (e.message||e);
    document.getElementById("backupMsg").className = "msg error";
  }));
  document.getElementById("exportClientsCsvBackupBtn")?.addEventListener("click", () => saveSheetCsv("clients", "clients").catch(e => {
    document.getElementById("backupMsg").textContent = "Export failed: " + (e.message||e);
    document.getElementById("backupMsg").className = "msg error";
  }));
  async function exportXlsx(store, sheetName, filenamePrefix) {
    const msg = document.getElementById("backupMsg");
    msg.textContent = "Exporting Excel..."; msg.className = "msg";
    if (window.__orbitEnsureXlsx) await window.__orbitEnsureXlsx();
    if (typeof XLSX === "undefined") throw new Error("Excel library unavailable");
    const rows = await tsGetAllSafe(store);
    const clean = (rows || []).map(r => {
      const o = Object.assign({}, r);
      delete o.passwordHash; delete o.salt; delete o.password;
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(clean);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const filename = filenamePrefix + "-" + new Date().toISOString().slice(0,10) + ".xlsx";
    const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    await orbitSaveFile(blob, filename, { share: true, title: filenamePrefix + " Excel", mime: blob.type, dialogTitle: "Save Excel" });
    msg.textContent = "Exported " + filename; msg.className = "msg success";
  }
  document.getElementById("exportProductsXlsxBtn")?.addEventListener("click", () => exportXlsx("products", "Products", "products").catch(e => {
    document.getElementById("backupMsg").textContent = "Excel export failed: " + (e.message||e);
    document.getElementById("backupMsg").className = "msg error";
  }));
  document.getElementById("exportClientsXlsxBtn")?.addEventListener("click", () => exportXlsx("clients", "Clients", "clients").catch(e => {
    document.getElementById("backupMsg").textContent = "Excel export failed: " + (e.message||e);
    document.getElementById("backupMsg").className = "msg error";
  }));
  async function importSheet(kind) {
    const msg = document.getElementById("sheetImportMsg");
    const input = document.getElementById(kind === "products" ? "restoreProductsSheet" : "restoreClientsSheet");
    if (!input || !input.files || !input.files.length) {
      msg.textContent = "Choose a CSV or Excel file first."; msg.className = "msg error"; return;
    }
    msg.textContent = "Importing..."; msg.className = "msg";
    try {
      const rows = await readSpreadsheet(input.files[0]);
      let ok = 0, fail = 0;
      if (kind === "products") {
        for (const row of rows) {
          try {
            const name = row.name || row.Name || row.product || "";
            if (!name) { fail++; continue; }
            const payload = {
              name: name,
              brand: row.brand || "",
              category: row.category || "",
              unit: row.unit || "pcs",
              price: Number(row.price || row.selling_price || 0) || 0,
              cost: Number(row.cost || row.cost_price || 0) || 0,
              stock: Number(row.stock || 0) || 0,
              sku: row.sku || "",
              barcode: row.barcode || "",
              hsnCode: row.hsn || row.hsn_code || row.hsnCode || "",
              storeType: row.storeType || row.store_type || "retail",
              photo: row.photo_path || row.photo || row.image || null,
            };
            const taxId = await resolveTaxSlabId(row);
            if (taxId) payload.taxSlabId = taxId;
            const res = await api("/products", { method: "POST", body: payload });
            if (res && res.ok) ok++; else fail++;
          } catch (e) { fail++; }
        }
        try { renderProducts(); } catch(e){}
      } else {
        for (const row of rows) {
          try {
            const name = row.name || row.Name || row.client || "";
            if (!name) { fail++; continue; }
            const payload = {
              name: name,
              email: row.email || "",
              phone: row.phone || row.mobile || "",
              address: row.address || "",
              gstin: row.gstin || row.GSTIN || "",
            };
            const res = await api("/clients", { method: "POST", body: payload });
            if (res && res.ok) ok++; else fail++;
          } catch (e) { fail++; }
        }
        try { renderClients(); } catch(e){}
      }
      msg.textContent = "Imported " + ok + " row(s)" + (fail ? (", " + fail + " skipped") : "") + ".";
      msg.className = "msg success";
    } catch (e) {
      msg.textContent = "Import failed: " + (e.message || e); msg.className = "msg error";
    }
  }
  document.getElementById("importProductsSheetBtn")?.addEventListener("click", () => importSheet("products"));
  document.getElementById("importClientsSheetBtn")?.addEventListener("click", () => importSheet("clients"));

  document.getElementById("restoreSelectAll")?.addEventListener("click", () => {
    document.querySelectorAll(".restore-cat").forEach(c => { c.checked = true; });
  });
  document.getElementById("restoreSelectNone")?.addEventListener("click", () => {
    document.querySelectorAll(".restore-cat").forEach(c => { c.checked = false; });
  });
  document.getElementById("restoreBackupBtn").addEventListener("click", async () => {
    const msg = document.getElementById("restoreMsg");
    const input = document.getElementById("restoreFile");
    if (!input.files.length) { msg.textContent = "Choose a backup ZIP or JSON file first."; msg.className = "msg error"; return; }
    if (!(typeof tsWhoami === "function" && tsWhoami().ok)) {
      msg.textContent = "Sign-in required."; msg.className = "msg error"; return;
    }
    const modeEl = document.querySelector('input[name="restoreMode"]:checked');
    const mode = modeEl ? modeEl.value : "merge";
    const only = [];
    document.querySelectorAll(".restore-cat:checked").forEach(c => {
      String(c.value).split(",").forEach(s => { s = s.trim(); if (s) only.push(s); });
    });
    if (!only.length) {
      msg.textContent = "Select at least one category to restore."; msg.className = "msg error"; return;
    }
    const modeLabel = mode === "merge"
      ? "MERGE into existing data (nothing is wiped; matching IDs are updated)"
      : "REPLACE only the selected categories (those categories are cleared first)";
    if (!confirm("Restore mode: " + modeLabel + "\n\nCategories: " + only.join(", ") + "\n\nContinue?")) return;
    msg.textContent = "Restoring (" + mode + ")..."; msg.className = "msg";
    try {
      const f = input.files[0];
      if (!f) { msg.textContent = "Choose a backup file first."; msg.className = "msg error"; return; }
      const result = await tsRestoreFromFile(f, { mode: mode, only: only });
      msg.textContent = "Restored successfully (" + ((result && result.mode) || mode) + "). Reloading...";
      msg.className = "msg success";
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      console.error(e);
      var em = (e && e.message) ? e.message : String(e);
      if (/PK|not valid JSON|Unexpected token/i.test(em)) {
        em = "Could not read backup. Select the OrbitBills .zip file (not a photo/screenshot). If it still fails, open the zip on a computer and restore the .json inside.";
      }
      msg.textContent = "Restore failed: " + em; msg.className = "msg error";
    }
  });
})();



async function viewInvoice(id){
  try{
  const data = await api(`/invoices/${id}`);
  if (!data || !data.ok) { alert((data && data.error) || "Could not load invoice."); return; }
  const inv = data.invoice;
  if (!inv) { alert("Invoice not found."); return; }
  const branding = data.branding || (typeof brandingCache !== "undefined" ? brandingCache : {}) || {};
  let layout = data.layout;
  if (layout && typeof layout.elements === "string") {
    try { layout.elements = JSON.parse(layout.elements); } catch(e){ layout.elements = []; }
  }
  const canvas = document.getElementById("viewInvoiceCanvas");
  if (!canvas) { alert("Preview area missing"); return; }
  if (!layout || !Array.isArray(layout.elements) || !layout.elements.length) {
    canvas.innerHTML = `<div style="padding:24px;"><h3>${escapeHtml(inv.invoice_number)}</h3>
      <p>Client: ${escapeHtml(inv.client_name)}</p>
      <p>Total: ${money(inv.total)}</p>
      <p>Status: ${escapeHtml(inv.status)}</p>
      <ul>${(inv.items||[]).map(i=>`<li>${escapeHtml(i.name)} x ${i.qty} @ ${i.price}</li>`).join("")}</ul>
    </div>`;
  } else {
    // reuse sample renderer style
    const accent = branding.accent_color || "#0b3d91";
    const brandName = branding.brand_name || "TechSerenia";
    const tagline = branding.brand_tagline || "OrbitBills";
    const address = branding.brand_address || "";
    const phone = branding.brand_phone || "";
    const email = branding.brand_email || "";
    const footer = branding.footer_note || "";
    const logoSrc = branding.custom_brand_logo || "logo.png";
    const showTs = (branding.show_techserenia_logo || "yes") === "yes";
    const dateStr = inv.created_at ? formatIndiaTime(inv.created_at) : "";
    const items = inv.items || [];
    const blockHtml = {};
    layout.elements.forEach(el => {
      let inner = "";
      if (el.type === "logo") { const hasCustom = logoSrc && (logoSrc.startsWith("data:") || (logoSrc !== "logo.png" && logoSrc.indexOf("logo.png") < 0) || brandingCache.custom_brand_logo); inner = (showTs || hasCustom) ? `<img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'">` : ""; }
      else if (el.type === "brand_name") inner = `<div class="p-brand-name" style="color:${accent};">${escapeHtml(brandName)}</div><div style="font-size:10px;color:var(--slate);">${escapeHtml(tagline)}</div>`;
      else if (el.type === "brand_address") {
        const contact = [phone, email].filter(Boolean).join(" · ");
        inner = `<div style="font-size:10px;color:var(--slate);white-space:pre-wrap;">${escapeHtml(address)}${contact ? "\n" + escapeHtml(contact) : ""}</div>`;
      }
      else if (el.type === "invoice_meta") inner = `<div style="font-size:10px;text-align:right;"><strong>${escapeHtml(inv.invoice_number)}</strong><br>${dateStr}</div>`;
      else if (el.type === "bill_to") inner = `<div style="font-size:10px;"><strong>Bill to</strong><br>${escapeHtml(inv.client_name||"")}</div>`;
      else if (el.type === "items_table") inner = `<table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid ${accent};"><th style="text-align:left;">Item</th><th>Qty</th><th>Price</th><th>Tax</th><th style="text-align:right;">Amount</th></tr></thead><tbody>${items.map(i=>`<tr style="border-bottom:1px solid #eee;"><td>${escapeHtml(i.name)}</td><td style="text-align:center;">${i.qty}</td><td style="text-align:right;">${Number(i.price).toFixed(2)}</td><td style="text-align:center;">${i.tax_percent||0}%</td><td style="text-align:right;">${(i.qty*i.price).toFixed(2)}</td></tr>`).join("")}</tbody></table>`;
      else if (el.type === "totals") inner = `<div style="font-size:11px;text-align:right;"><div>Subtotal: ${Number(inv.subtotal||0).toFixed(2)}</div><div>Tax: ${Number(inv.tax_amount||0).toFixed(2)}</div><div>Discount: ${Number(inv.discount||0).toFixed(2)}</div>${(inv.credit_applied||0)>0?`<div>Credit: ${Number(inv.credit_applied).toFixed(2)}</div>`:""}<div style="font-weight:700;font-size:14px;color:${accent};margin-top:4px;">Total: ${Number(inv.total||0).toFixed(2)}</div></div>`;
      else if (el.type === "footer_note" || el.type === "footer") inner = `<div style="font-size:10px;color:var(--slate);white-space:pre-wrap;">${escapeHtml(footer)}</div>`;
    else if (el.type === "regulations") {
      const regs = (document.getElementById("bRegulations") && document.getElementById("bRegulations").value) || brandingCache.invoice_regulations || "";
      inner = `<div style="font-size:9px;color:var(--slate);white-space:pre-wrap;line-height:1.35;">${escapeHtml(regs)}</div>`;
    }
      else if (el.type === "orbitbills_badge") inner = `<div class="p-orbit"><img src="logo.png" onerror="this.style.display='none'">Powered by OrbitBills</div>`;
      else if (el.type === "upi_qr") {
        const qr = branding.upi_qr_image || "";
        inner = (qr && String(qr).startsWith("data:"))
          ? `<img src="${qr}" style="width:100%;height:100%;object-fit:contain;background:#fff" alt="Payment QR">`
          : `<div style="font-size:9px;color:var(--slate);border:1px dashed var(--border);height:100%;display:flex;align-items:center;justify-content:center">QR</div>`;
      }
      blockHtml[el.id] = inner;
    });
    const wm = `<div class="p-block" style="left:12px;top:760px;width:280px;height:28px;"><div style="font-size:9px;color:#64748b;font-weight:600;">Powered By OrbitBills by TechSerenia</div></div>`;
    canvas.innerHTML = layout.elements.map(el => `<div class="p-block" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;">${blockHtml[el.id]||""}</div>`).join("") + wm;
  }
  window.__viewingInvoice = inv;
  // Paper size from layout
  try{
    var paper = orbitPaperSize(layout);
    canvas.setAttribute("data-design-w", paper.w);
    canvas.setAttribute("data-design-h", paper.h);
    canvas.style.width = paper.w + "px";
    canvas.style.height = paper.h + "px";
    canvas.className = "invoice-preview size-" + ((layout && (layout.paper_size||layout.paperSize||"a4")) || "a4");
    var lab = document.getElementById("viewInvoicePaperLabel");
    if(lab) lab.textContent = paper.label + " paper preview";
  }catch(e){}
  openModal("viewInvoiceModal");
  setTimeout(orbitScaleInvoicePreview, 50);
  setTimeout(orbitScaleInvoicePreview, 200);
  window.addEventListener("resize", orbitScaleInvoicePreview);
  }catch(err){
    console.error("viewInvoice", err);
    alert("Could not open invoice");
  }
}
async function markPaid(id){ await api(`/invoices/${id}/status`, { method: "POST", body: { status: "paid", method: "cash" } }); renderInvoices(); renderOverview(); }
async function markUnpaid(id){ await api(`/invoices/${id}/status`, { method: "POST", body: { status: "unpaid" } }); renderInvoices(); renderOverview(); }


document.getElementById("shareInvoiceSocialBtn")?.addEventListener("click", function(){
  orbitShareInvoiceSocial(window.__viewingInvoice);
});

document.getElementById("printInvoiceBtn")?.addEventListener("click", () => window.print());
document.getElementById("emailInvoiceBtn")?.addEventListener("click", async () => {
  const inv = window.__viewingInvoice;
  if (!inv) return;
  let to = "";
  if (inv.client_id) {
    const cdata = await api("/clients");
    const c = (cdata.clients||[]).find(x => x.id === inv.client_id);
    if (c) to = c.email || "";
  }
  closeModal("viewInvoiceModal");
  document.querySelector('.nav-item[data-panel=email]')?.click();
  const toEl = document.getElementById("emailTo");
  if (toEl) {
    toEl.value = to;
    document.getElementById("emailSubject").value = "Invoice " + inv.invoice_number;
    document.getElementById("emailBody").value = "Dear " + (inv.client_name||"Customer") + ",\\n\\nInvoice: " + inv.invoice_number + "\\nTotal: " + money(inv.total) + "\\nStatus: " + inv.status + "\\n\\nThank you.";
  }
});
document.getElementById("invoiceStatusFilter")?.addEventListener("change", () => renderInvoices());
document.getElementById("invoiceFromFilter")?.addEventListener("change", () => renderInvoices());
document.getElementById("invoiceToFilter")?.addEventListener("change", () => renderInvoices());

// Fast auth + light first paint — never block phone on heavy seed/CDN
(function authBoot(){
  function hideBoot(){ try{ if(window.__orbitHideBoot) window.__orbitHideBoot(); }catch(e){} }
  hideBoot();
  setTimeout(hideBoot, 50);
  setTimeout(hideBoot, 200);

  function hasSession(){
    try {
      if (typeof tsWhoami === "function") {
        var w = tsWhoami();
        if (w && w.ok) return w;
      }
    } catch (e) {}
    try {
      var raw = localStorage.getItem("ts_session");
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (s && s.email) return { ok: true, email: s.email, role: s.role, name: s.name, roles: s.roles || [], uniform: !!s.uniform };
    } catch (e) {}
    return null;
  }

  var who = hasSession();
  if (!who || !who.ok) {
    hideBoot();
    setTimeout(function(){ window.location.replace("signin.html"); }, 60);
    return;
  }
  try{
    if(typeof tsRememberPanel === "function") tsRememberPanel("admin-dashboard.html");
    else localStorage.setItem("ts_last_panel","admin-dashboard.html");
  }catch(e){}

  // Seed + overview in background so UI shows immediately
  (async function(){
    try { if (typeof tsSeedDefaults === "function") await Promise.race([tsSeedDefaults(), new Promise(function(r){ setTimeout(r, 1200); })]); } catch(e){}
    hideBoot();
    try { if (typeof renderOverview === "function") await Promise.race([renderOverview(), new Promise(function(r){ setTimeout(r, 2500); })]); } catch(e){ console.warn(e); }
    try { if (typeof renderLowStock === "function") renderLowStock(); } catch(e){}
    try {
      if (typeof tsOnSync === "function") tsOnSync(function(){
        try { renderOverview(); } catch (e) {}
        try { renderLowStock(); } catch (e) {}
      });
    } catch (e) {}
  })();
})();



function composeToClient(email){
  if (!email) { alert("This client has no email address."); return; }
  document.querySelector('.nav-item[data-panel=email]')?.click();
  const to = document.getElementById("emailTo");
  if (to) { to.value = email; }
}


(function(){
  const updateBtn = document.getElementById("updateLayoutBtn");
  const deleteBtn = document.getElementById("deleteLayoutBtn");
  if (!updateBtn) return;
  updateBtn.addEventListener("click", async () => {
    const msg = document.getElementById("designerMsg");
    const id = document.getElementById("designerLayoutId")?.value;
    if (!id) { msg.textContent = "This is a preset — save as a new layout first."; msg.className = "msg error"; return; }
    const name = document.getElementById("designerLayoutName").value.trim() || "Custom layout";
    const data = await api(`/invoice-layouts/${id}`, { method: "PUT", body: { name, elements: designerElements, paperSize: designerPaperSize } });
    if (!data.ok) { msg.textContent = data.error || "Could not update."; msg.className = "msg error"; return; }
    msg.textContent = "Layout updated."; msg.className = "msg success";
    const lData = await api("/invoice-layouts");
    if (lData.ok) layoutsCache = lData.layouts;
    renderLayoutCards();
    renderInvoicePreview();
  });
  deleteBtn?.addEventListener("click", async () => {
    const id = document.getElementById("designerLayoutId")?.value;
    if (!id || !confirm("Delete this custom layout?")) return;
    const data = await api(`/invoice-layouts/${id}`, { method: "DELETE" });
    if (!data.ok) { alert(data.error || "Could not delete."); return; }
    const lData = await api("/invoice-layouts");
    if (lData.ok) layoutsCache = lData.layouts;
    const bData = await api("/branding");
    if (bData.ok) brandingCache = bData.branding;
    renderLayoutCards();
    loadLayoutIntoDesigner(activeLayout());
    renderInvoicePreview();
  });
  // wrap loadLayoutIntoDesigner
  if (typeof loadLayoutIntoDesigner === "function") {
    const orig = loadLayoutIntoDesigner;
    window.loadLayoutIntoDesigner = function(layout){
      orig(layout);
      if (!layout) return;
      const idEl = document.getElementById("designerLayoutId");
      if (idEl) idEl.value = layout.is_preset ? "" : String(layout.id);
      if (updateBtn) updateBtn.style.display = layout.is_preset ? "none" : "block";
      if (deleteBtn) deleteBtn.style.display = layout.is_preset ? "none" : "block";
    };
  }
})();


// =========================================================================
// SUPPLIERS
// =========================================================================
let suppliersCache = [];
async function renderSuppliers(filter){
  const q = filter !== undefined ? filter : (document.getElementById("supplierSearch")||{}).value || "";
  const data = await api("/suppliers" + (q ? `?q=${encodeURIComponent(q)}` : ""));
  if (!data.ok) return;
  suppliersCache = data.suppliers;
  const tbody = document.getElementById("suppliersTableBody");
  if (!tbody) return;
  tbody.innerHTML = suppliersCache.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.email)}</td><td>${escapeHtml(s.phone)}</td>
      <td>${escapeHtml(s.gstin)}</td>
      <td>
        <span class="actions-cell">
        <button class="btn btn-ghost btn-sm" onclick="editSupplier(${s.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSupplier(${s.id})">Delete</button>
        ${moreBtn(`onclick="supplierMore(${s.id})"`)}
        </span>
      </td>
    </tr>`).join("");
  document.getElementById("suppliersEmpty").style.display = suppliersCache.length ? "none" : "block";
}
document.getElementById("supplierSearch")?.addEventListener("input", e => renderSuppliers(e.target.value));
document.getElementById("openAddSupplier")?.addEventListener("click", () => {
  document.getElementById("supplierForm").reset();
  document.getElementById("supplierId").value = "";
  document.getElementById("supplierModalTitle").textContent = "Add supplier";
  openModal("supplierModal");
});
function supplierMore(id){
  openAdminActions("Supplier", "#"+id, [
    { label: "Edit", primary: true, run: () => editSupplier(id) },
    { label: "Delete", danger: true, run: () => deleteSupplier(id) },
  ]);
}
function editSupplier(id){
  const s = suppliersCache.find(x => x.id === id);
  if (!s) return;
  document.getElementById("supplierId").value = s.id;
  document.getElementById("sName").value = s.name;
  document.getElementById("sEmail").value = s.email || "";
  document.getElementById("sPhone").value = s.phone || "";
  document.getElementById("sGstin").value = s.gstin || "";
  document.getElementById("sAddress").value = s.address || "";
  document.getElementById("sNotes").value = s.notes || "";
  document.getElementById("supplierModalTitle").textContent = "Edit supplier";
  openModal("supplierModal");
}
async function deleteSupplier(id){
  if (!confirm("Delete this supplier?")) return;
  await api(`/suppliers/${id}`, { method: "DELETE" });
  renderSuppliers();
}
document.getElementById("supplierForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("supplierId").value;
  const payload = {
    name: document.getElementById("sName").value.trim(),
    email: document.getElementById("sEmail").value.trim(),
    phone: document.getElementById("sPhone").value.trim(),
    gstin: document.getElementById("sGstin").value.trim(),
    address: document.getElementById("sAddress").value.trim(),
    notes: document.getElementById("sNotes").value.trim(),
  };
  const data = id ? await api(`/suppliers/${id}`, { method: "PUT", body: payload })
                  : await api("/suppliers", { method: "POST", body: payload });
  if (!data.ok) { document.getElementById("supplierFormMsg").textContent = data.error || "Error"; return; }
  closeModal("supplierModal");
  renderSuppliers();
});

// =========================================================================
// PURCHASES
// =========================================================================
let purchasesCache = [];
let poItemCounter = 0;
function addPoItemRow(item){
  item = item || {};
  const wrap = document.getElementById("poItemsBuilder");
  if (!wrap) return;
  const row = document.createElement("div");
  row.className = "item-row";
  const opts = ['<option value="">Custom</option>'].concat(
    (productsCache||[]).map(p => `<option value="${p.id}" data-cost="${p.cost_price||0}">${escapeHtml(p.name)}</option>`)
  ).join("");
  row.innerHTML = `
    <select class="po-product">${opts}</select>
    <input type="number" class="po-qty" min="0" step="1" value="${item.qty||1}" placeholder="Qty">
    <input type="number" class="po-cost" min="0" step="0.01" value="${item.cost||0}" placeholder="Cost">
    <input type="number" class="po-tax" min="0" step="0.01" value="${item.taxPercent||0}" placeholder="Tax %">
    <button type="button">&times;</button>
    <input type="text" class="po-name" value="${escapeHtml(item.name||"")}" placeholder="Name if custom" style="grid-column:1/-1;">
  `;
  row.querySelector(".po-product").addEventListener("change", function(){
    const opt = this.selectedOptions[0];
    if (opt && opt.value) {
      row.querySelector(".po-cost").value = opt.dataset.cost || 0;
      row.querySelector(".po-name").style.display = "none";
    } else row.querySelector(".po-name").style.display = "block";
    recalcPo();
  });
  row.querySelectorAll("input").forEach(i => i.addEventListener("input", recalcPo));
  row.querySelector("button").addEventListener("click", () => { row.remove(); recalcPo(); });
  wrap.appendChild(row);
  recalcPo();
}
function collectPoItems(){
  return Array.from(document.querySelectorAll("#poItemsBuilder .item-row")).map(row => {
    const sel = row.querySelector(".po-product");
    const name = sel.value ? sel.selectedOptions[0].textContent : row.querySelector(".po-name").value.trim();
    return {
      productId: sel.value ? parseInt(sel.value) : null,
      name, qty: parseFloat(row.querySelector(".po-qty").value)||0,
      cost: parseFloat(row.querySelector(".po-cost").value)||0,
      taxPercent: parseFloat(row.querySelector(".po-tax").value)||0,
    };
  }).filter(i => i.name);
}
function recalcPo(){
  const items = collectPoItems();
  const sub = items.reduce((s,i)=>s+i.qty*i.cost,0);
  const tax = items.reduce((s,i)=>s+i.qty*i.cost*(i.taxPercent/100),0);
  const el = document.getElementById("poPreviewTotal");
  if (el) el.textContent = money(sub+tax);
}
async function renderPurchases(){
  const data = await api("/purchases");
  if (!data.ok) return;
  purchasesCache = data.purchases;
  const tbody = document.getElementById("purchasesTableBody");
  if (!tbody) return;
  tbody.innerHTML = purchasesCache.map(p => `
    <tr>
      <td>${escapeHtml(p.purchase_number)}</td>
      <td>${escapeHtml(p.supplier_name)}</td>
      <td>${(p.items||[]).length}</td>
      <td>${money(p.total)}</td>
      <td><span class="pill ${p.status==='received'?'paid':'unpaid'}">${escapeHtml(p.status)}</span></td>
      <td>${p.created_at ? new Date(p.created_at.replace(' ','T')+'Z').toLocaleDateString() : ""}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deletePurchase(${p.id})">Delete</button></td>
    </tr>`).join("");
  document.getElementById("purchasesEmpty").style.display = purchasesCache.length ? "none" : "block";
}
document.getElementById("openAddPurchase")?.addEventListener("click", async () => {
  await renderProducts();
  await renderSuppliers();
  document.getElementById("purchaseForm").reset();
  document.getElementById("poNumber").value = "PO-" + Date.now().toString().slice(-6);
  document.getElementById("poItemsBuilder").innerHTML = "";
  const sel = document.getElementById("poSupplierSelect");
  sel.innerHTML = '<option value="">Select supplier</option>' + suppliersCache.map(s =>
    `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  addPoItemRow();
  openModal("purchaseModal");
});
document.getElementById("poSupplierSelect")?.addEventListener("change", e => {
  const opt = e.target.selectedOptions[0];
  if (opt && opt.value) document.getElementById("poSupplierName").value = opt.textContent;
});
document.getElementById("addPoItemRow")?.addEventListener("click", () => addPoItemRow());
document.getElementById("purchaseForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const items = collectPoItems();
  const msg = document.getElementById("purchaseFormMsg");
  if (!items.length) { msg.textContent = "Add items."; msg.className = "msg error"; return; }
  const payload = {
    purchaseNumber: document.getElementById("poNumber").value.trim(),
    supplierId: document.getElementById("poSupplierSelect").value ? parseInt(document.getElementById("poSupplierSelect").value) : null,
    supplierName: document.getElementById("poSupplierName").value.trim(),
    notes: document.getElementById("poNotes").value.trim(),
    status: "received",
    items,
  };
  const data = await api("/purchases", { method: "POST", body: payload });
  if (!data.ok) { msg.textContent = data.error || "Failed"; msg.className = "msg error"; return; }
  closeModal("purchaseModal");
  renderPurchases();
  renderProducts();
  renderOverview();
});
async function deletePurchase(id){
  if (!confirm("Delete purchase and reverse stock?")) return;
  await api(`/purchases/${id}`, { method: "DELETE" });
  renderPurchases();
  renderProducts();
}

// =========================================================================
// ANALYTICS + CHARTS
// =========================================================================
let revenueChartObj, productsChartObj, clientsChartObj;
async function renderAnalytics(){
  try { if (window.__orbitEnsureChart) await window.__orbitEnsureChart(); } catch (e) {}
  const data = await api("/analytics");
  if (!data.ok) {
    const msg = document.getElementById("analyticsLowStockBody");
    if (msg) msg.innerHTML = `<tr><td colspan="5">${escapeHtml(data.error || "Could not load analytics")}</td></tr>`;
    return;
  }
  // Support both new (revenue.labels/data) and legacy (monthly) shapes
  let revLabels = (data.revenue && data.revenue.labels) || (data.monthly || []).map(m => m.month) || [];
  let revPaid = (data.revenue && data.revenue.data) || (data.monthly || []).map(m => m.paid || m.total || 0) || [];
  const ctx1 = document.getElementById("revenueChart");
  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } }
  };
  if (ctx1 && window.Chart) {
    if (revenueChartObj) revenueChartObj.destroy();
    revenueChartObj = new Chart(ctx1, {
      type: "bar",
      data: { labels: revLabels.length ? revLabels : ["No sales yet"],
        datasets: [{ label: "Revenue", data: revPaid.length ? revPaid : [0], backgroundColor: "#0b3d91", borderRadius: 6 }] },
      options: { ...chartOpts, scales: { y: { beginAtZero: true }, x: { ticks: { maxRotation: 45, minRotation: 0, autoSkip: true, font: { size: 10 } } } } }
    });
  }
  const topProducts = data.topProducts || [];
  const ctx2 = document.getElementById("productsChart");
  if (ctx2 && window.Chart) {
    if (productsChartObj) productsChartObj.destroy();
    productsChartObj = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: topProducts.map(p => p.name).concat(topProducts.length ? [] : ["None"]),
        datasets: [{ data: topProducts.map(p => p.revenue != null ? p.revenue : p.qty).concat(topProducts.length ? [] : [1]),
          backgroundColor: ["#0b3d91","#2f6feb","#158a53","#b8860b","#8e44ad","#c0392b","#5b6b82","#94a3b8"] }]
      },
      options: { ...chartOpts, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }
    });
  }
  const topClients = data.topClients || [];
  const ctx3 = document.getElementById("clientsChart");
  if (ctx3 && window.Chart) {
    if (clientsChartObj) clientsChartObj.destroy();
    clientsChartObj = new Chart(ctx3, {
      type: "bar",
      data: {
        labels: topClients.map(c => c.name).concat(topClients.length ? [] : ["None"]),
        datasets: [{ label: "Revenue", data: topClients.map(c => c.total != null ? c.total : c.revenue || 0).concat(topClients.length ? [] : [0]), backgroundColor: "#2f6feb", borderRadius: 6 }]
      },
      options: { ...chartOpts, indexAxis: "y", scales: { x: { beginAtZero: true } } }
    });
  }
  // Charts built while panel was hidden often have 0 width — force resize after paint
  requestAnimationFrame(function(){
    try{
      if(revenueChartObj) revenueChartObj.resize();
      if(productsChartObj) productsChartObj.resize();
      if(clientsChartObj) clientsChartObj.resize();
    }catch(e){}
  });
  setTimeout(function(){
    try{
      if(revenueChartObj) revenueChartObj.resize();
      if(productsChartObj) productsChartObj.resize();
      if(clientsChartObj) clientsChartObj.resize();
    }catch(e){}
  }, 200);
  const mt = document.getElementById("marginsTableBody");
  if (mt) mt.innerHTML = (data.margins || topProducts).map(m => `
    <tr><td>${escapeHtml(m.name)}</td><td>${money(m.revenue)}</td><td>${money(m.cost || 0)}</td>
    <td>${money(m.profit != null ? m.profit : m.margin || 0)}</td><td>${m.marginPct != null ? m.marginPct + "%" : "—"}</td></tr>`).join("") || '<tr><td colspan="5">No margin data yet</td></tr>';
  const lt = document.getElementById("analyticsLowStockBody");
  if (lt) lt.innerHTML = (data.lowStock||[]).map(p => `
    <tr><td>${escapeHtml(p.name)}</td><td>${p.stock}</td><td>${p.low_stock_limit ?? "default"}</td>
    <td>${money(p.price)}</td><td>${money(p.cost_price)}</td></tr>`).join("") || '<tr><td colspan="5">Nothing low on stock</td></tr>';
}

document.getElementById("sendLowStockAlertBtn")?.addEventListener("click", async () => {
  const msg = document.getElementById("lowStockAlertMsg");
  const smtp = await idbGet("smtp");
  if (!smtp || !smtp.host) { msg.textContent = "Configure SMTP in Email panel first."; msg.className = "msg error"; return; }
  msg.textContent = "Sending..."; msg.className = "msg";
  const data = await api("/low-stock/alert", { method: "POST", body: { smtp, to: smtp.fromEmail || smtp.user } });
  if (!data.ok) { msg.textContent = data.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = data.message || (`Alert sent for ${data.count} item(s).`); msg.className = "msg success";
});

// =========================================================================
// BARCODE / QR
// =========================================================================
/** Code 128B barcode encoder + canvas renderer (no external lib). */
const CODE128_B = (function(){
  // Patterns: 0=space(white), 1=bar(black) widths for 6 modules; value 0-106
  const PAT = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
    "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
    "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
    "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
    "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
    "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
    "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
    "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
    "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
    "114131","311141","411131","211412","211214","211232","2331112"
  ];
  function encode(text){
    text = String(text || "");
    if (!text) text = "0";
    // Code set B start = 104
    let sum = 104;
    const values = [104];
    for (let i = 0; i < text.length; i++) {
      let c = text.charCodeAt(i);
      if (c < 32 || c > 126) c = 63; // ?
      const v = c - 32;
      values.push(v);
      sum += v * (i + 1);
    }
    values.push(sum % 103); // checksum
    values.push(106); // stop
    return values.map(v => PAT[v] || PAT[0]);
  }
  function draw(canvas, text, opts){
    opts = opts || {};
    const fg = opts.fg || "#000000";
    const bg = opts.bg || "#ffffff";
    const showText = opts.showText !== false;
    const patterns = encode(text);
    // total modules
    let modules = 0;
    for (const p of patterns) for (const ch of p) modules += parseInt(ch, 10);
    modules += 2; // quiet zone-ish
    const pad = 12;
    const barH = opts.barHeight || 60;
    const textH = showText ? 18 : 0;
    const w = Math.max(canvas.width || 240, modules * 2 + pad * 2);
    const h = barH + textH + 16;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const unit = (w - pad * 2) / modules;
    let x = pad;
    let bar = true; // start with bar for first width of first pattern — Code128 patterns alternate starting with bar
    ctx.fillStyle = fg;
    for (const p of patterns) {
      for (let i = 0; i < p.length; i++) {
        const width = parseInt(p[i], 10) * unit;
        if (bar) ctx.fillRect(Math.floor(x), 8, Math.ceil(width), barH);
        x += width;
        bar = !bar;
      }
    }
    if (showText) {
      ctx.fillStyle = fg;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(text), w / 2, barH + 20);
      ctx.textAlign = "left";
    }
  }
  return { encode, draw };
})();

function drawSimpleBarcode(canvas, text, opts){
  CODE128_B.draw(canvas, text, opts || {});
}
async function showBarcode(productId){
  const p = productsCache.find(x => x.id === productId);
  if (!p) return;
  const code = p.barcode || p.sku || String(p.id);
  document.getElementById("barcodeLabel").textContent = p.name + " — " + code;
  drawSimpleBarcode(document.getElementById("barcodeCanvas"), code, { barHeight: 56 });
  const qrCanvas = document.getElementById("qrCanvas");
  try {
    if (typeof tsDrawQrToCanvas === "function") {
      await tsDrawQrToCanvas(qrCanvas, code, { size: 160 });
    } else {
      await tsWaitForQrLib(2000);
      // fallback: matrix draw already inside tsDrawQrToCanvas; minimal text fallback
      const ctx = qrCanvas.getContext("2d");
      qrCanvas.width = 160; qrCanvas.height = 160;
      ctx.fillStyle = "#fff"; ctx.fillRect(0,0,160,160);
      ctx.fillStyle = "#111"; ctx.font = "11px monospace"; ctx.fillText(code.slice(0,18), 8, 80);
    }
  } catch (e) {
    console.warn("QR draw", e);
  }
  openModal("barcodeModal");
}
document.getElementById("printBarcodeBtn")?.addEventListener("click", () => window.print());

// =========================================================================
// SHARE LINK + WHATSAPP
// =========================================================================
async function shareInvoice(id){
  try{
    const data = await api(`/invoices/${id}/share`, { method: "POST" });
    const inv = (invoicesCache||[]).find(x => Number(x.id)===Number(id));
    const summary = inv
      ? ("Invoice " + (inv.invoice_number||id) + "\nClient: " + (inv.client_name||"Walk-in") + "\nTotal: " + money(inv.total) + "\nStatus: " + (inv.status||""))
      : ("Invoice #" + id);
    let url = "";
    if (data && data.ok) {
      url = data.url || data.path || "";
      if (url && url.charAt(0) === "#") url = location.href.split("#")[0] + url;
      else if (url && url.charAt(0) === "/") url = location.origin + url;
      else if (!url && data.token) url = location.origin + "/#local-share-" + data.token;
    }
    const textOut = url ? (summary + "\n" + url) : summary;
    if (navigator.share) {
      try { await navigator.share({ title: "Invoice", text: textOut }); return; } catch(e){ if(e && e.name==="AbortError") return; }
    }
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(textOut); alert("Invoice summary copied"); return; } catch(e) {}
    }
    prompt("Copy:", textOut);
  }catch(err){
    console.error(err);
    alert("Share failed");
  }
}
async function whatsappInvoice(id){
  try{
    let phone = "";
    let inv = (invoicesCache||[]).find(x => Number(x.id)===Number(id));
    if (!inv) {
      const invData = await api(`/invoices/${id}`);
      if (invData && invData.ok) inv = invData.invoice;
    }
    if (inv && inv.client_id) {
      const cdata = await api("/clients");
      const c = (cdata.clients||[]).find(x => Number(x.id)===Number(inv.client_id));
      if (c) phone = (c.phone || "").replace(/\D/g,"");
    }
    if (!phone) phone = (prompt("Client WhatsApp number (with country code, e.g. 9198xxxxxxx):", "") || "").replace(/\D/g,"");
    const msg = inv
      ? `Invoice ${inv.invoice_number||id}\nTotal: ${money(inv.total)}\nStatus: ${inv.status||""}\nThank you — OrbitBills`
      : `Invoice #${id}`;
    const url = phone
      ? ("https://wa.me/" + phone + "?text=" + encodeURIComponent(msg))
      : ("https://wa.me/?text=" + encodeURIComponent(msg));
    window.open(url, "_blank");
  }catch(err){
    console.error(err);
    alert("WhatsApp open failed");
  }
}

// =========================================================================
// CLIENT STATEMENT
// =========================================================================
let statementClientId = null;
async function openStatement(id){
  statementClientId = id;
  openModal("statementModal");
  await loadStatement();
}
async function loadStatement(){
  if (!statementClientId) return;
  const from = document.getElementById("stmtFrom")?.value || "";
  const to = document.getElementById("stmtTo")?.value || "";
  let url = `/clients/${statementClientId}/statement?`;
  if (from) url += "from=" + encodeURIComponent(from) + "&";
  if (to) url += "to=" + encodeURIComponent(to);
  const data = await api(url);
  if (!data.ok) return;
  document.getElementById("statementTitle").textContent = "Statement — " + data.client.name;
  const s = data.summary;
  const body = document.getElementById("statementBody");
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px;">
      <div class="stat-card"><div class="label">Invoiced</div><div class="value" style="font-size:18px;">${money(s.totalInvoiced)}</div></div>
      <div class="stat-card"><div class="label">Paid</div><div class="value" style="font-size:18px;color:var(--green);">${money(s.totalPaid)}</div></div>
      <div class="stat-card"><div class="label">Unpaid</div><div class="value" style="font-size:18px;color:var(--amber);">${money(s.totalUnpaid)}</div></div>
      <div class="stat-card"><div class="label">Credit</div><div class="value" style="font-size:18px;">${money(s.creditBalance)}</div></div>
    </div>
    <div class="table-scroll"><table>
      <thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Status</th></tr></thead>
      <tbody>${(data.invoices||[]).map(i => `<tr>
        <td>${escapeHtml(i.invoice_number)}</td>
        <td>${i.created_at ? new Date(i.created_at.replace(' ','T')+'Z').toLocaleDateString() : ""}</td>
        <td>${money(i.total)}</td>
        <td><span class="pill ${i.status}">${escapeHtml(i.status)}</span></td>
      </tr>`).join("")}</tbody>
    </table></div>`;
}
document.getElementById("stmtReloadBtn")?.addEventListener("click", loadStatement);
document.getElementById("stmtPrintBtn")?.addEventListener("click", () => window.print());

// =========================================================================
// BULK ACTIONS
// =========================================================================
document.getElementById("prodSelectAll")?.addEventListener("change", e => {
  document.querySelectorAll(".prod-check").forEach(c => c.checked = e.target.checked);
});
document.getElementById("clientSelectAll")?.addEventListener("change", e => {
  document.querySelectorAll(".client-check").forEach(c => c.checked = e.target.checked);
});
document.getElementById("invSelectAll")?.addEventListener("change", e => {
  document.querySelectorAll(".inv-check").forEach(c => c.checked = e.target.checked);
});
document.getElementById("bulkDeleteProducts")?.addEventListener("click", async () => {
  const ids = Array.from(document.querySelectorAll(".prod-check:checked")).map(c => parseInt(c.value));
  if (!ids.length) return alert("Select products first.");
  if (!confirm(`Delete ${ids.length} product(s)?`)) return;
  await api("/products/bulk-delete", { method: "POST", body: { ids } });
  renderProducts(); renderOverview();
});
document.getElementById("bulkDeleteClients")?.addEventListener("click", async () => {
  const ids = Array.from(document.querySelectorAll(".client-check:checked")).map(c => parseInt(c.value));
  if (!ids.length) return alert("Select clients first.");
  if (!confirm(`Delete ${ids.length} client(s)?`)) return;
  await api("/clients/bulk-delete", { method: "POST", body: { ids } });
  renderClients(); renderOverview();
});
document.getElementById("bulkMarkPaid")?.addEventListener("click", async () => {
  const ids = Array.from(document.querySelectorAll(".inv-check:checked")).map(c => parseInt(c.value));
  if (!ids.length) return alert("Select invoices first.");
  await api("/invoices/bulk-status", { method: "POST", body: { ids, status: "paid" } });
  renderInvoices(); renderOverview();
});
document.getElementById("bulkDeleteInvoices")?.addEventListener("click", async () => {
  const ids = Array.from(document.querySelectorAll(".inv-check:checked")).map(c => parseInt(c.value));
  if (!ids.length) return alert("Select invoices first.");
  if (!confirm(`Delete ${ids.length} invoice(s)? Stock will be restored.`)) return;
  await api("/invoices/bulk-delete", { method: "POST", body: { ids } });
  renderInvoices(); renderOverview(); renderProducts();
});



// =========================================================================
// PAYMENTS
// =========================================================================
async function openPayment(invoiceId){
  document.getElementById("payInvoiceId").value = invoiceId;
  const data = await api(`/invoices/${invoiceId}/payments`);
  if (!data.ok) return;
  const inv = data.invoice;
  const due = Math.max(0, (inv.total||0) - (inv.amount_paid||0));
  document.getElementById("paymentInvoiceLabel").textContent =
    `Total ${money(inv.total)} · Paid ${money(inv.amount_paid)} · Due ${money(due)} · Status ${inv.status}`;
  document.getElementById("payAmount").value = due > 0 ? due.toFixed(2) : "";
  document.getElementById("paymentFormMsg").textContent = "";
  document.getElementById("paymentHistoryBody").innerHTML = (data.payments||[]).map(p => `
    <tr>
      <td>${p.created_at ? new Date(p.created_at.replace(' ','T')+'Z').toLocaleString() : ""}</td>
      <td>${money(p.amount)}</td><td>${escapeHtml(p.method)}</td><td>${escapeHtml(p.reference)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deletePayment(${p.id},${invoiceId})">Undo</button></td>
    </tr>`).join("");
  openModal("paymentModal");
}
document.getElementById("paymentForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const id = document.getElementById("payInvoiceId").value;
  const msg = document.getElementById("paymentFormMsg");
  const data = await api(`/invoices/${id}/payments`, { method: "POST", body: {
    amount: parseFloat(document.getElementById("payAmount").value),
    method: document.getElementById("payMethod").value,
    reference: document.getElementById("payRef").value.trim(),
    notes: document.getElementById("payNotes").value.trim(),
  }});
  if (!data.ok) { msg.textContent = data.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = "Saved. Status: " + data.status; msg.className = "msg success";
  openPayment(parseInt(id));
  renderInvoices(); renderOverview();
});
async function deletePayment(pid, invoiceId){
  if (!confirm("Remove this payment?")) return;
  await api(`/payments/${pid}`, { method: "DELETE" });
  openPayment(invoiceId); renderInvoices(); renderOverview();
}
async function paymentLink(invoiceId){
  try{
    const inv = (invoicesCache||[]).find(x => Number(x.id)===Number(invoiceId));
    const due = inv ? Math.max(0, Number(inv.total||0) - Number(inv.amount_paid||0)) : 0;
    let textOut = inv
      ? ("Invoice " + (inv.invoice_number||invoiceId) + " · Due " + money(due))
      : ("Invoice #" + invoiceId);
    try{
      const upi = (typeof brandingCache !== "undefined" && brandingCache.upi_id) ? brandingCache.upi_id : "";
      if (upi && due > 0) textOut += "\nUPI: " + upi + " · Amount: " + due.toFixed(2);
    }catch(e){}
    if (navigator.share) {
      try { await navigator.share({ title: "Payment", text: textOut }); return; } catch(e){ if(e && e.name==="AbortError") return; }
    }
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(textOut); alert("Payment info copied"); return; } catch(e) {}
    }
    prompt("Copy:", textOut);
  }catch(err){
    console.error(err);
    alert("Payment link unavailable offline");
  }
}

// =========================================================================
// QUOTATIONS
// =========================================================================
let quotesCache = [];
function addQtItemRow(item){
  item = item || {};
  const wrap = document.getElementById("qtItemsBuilder");
  if (!wrap) return;
  const row = document.createElement("div");
  row.className = "item-row";
  const opts = ['<option value="">Custom</option>'].concat(
    (productsCache||[]).map(p => `<option value="${p.id}" data-price="${p.price}" data-tax="${p.tax_percentage||0}">${escapeHtml(p.name)}</option>`)
  ).join("");
  row.innerHTML = `<select class="qt-product">${opts}</select>
    <input type="number" class="qt-qty" value="${item.qty||1}" min="0" step="0.01">
    <input type="number" class="qt-price" value="${item.price||0}" min="0" step="0.01">
    <input type="number" class="qt-tax" value="${item.taxPercent||0}" min="0" step="0.01">
    <button type="button">&times;</button>
    <input type="text" class="qt-name" value="${escapeHtml(item.name||'')}" placeholder="Name" style="grid-column:1/-1;">`;
  row.querySelector(".qt-product").addEventListener("change", function(){
    const opt = this.selectedOptions[0];
    if (opt && opt.value) {
      row.querySelector(".qt-price").value = opt.dataset.price || 0;
      row.querySelector(".qt-tax").value = opt.dataset.tax || 0;
    }
  });
  row.querySelector("button").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}
function collectQtItems(){
  return Array.from(document.querySelectorAll("#qtItemsBuilder .item-row")).map(row => {
    const sel = row.querySelector(".qt-product");
    const name = sel.value ? sel.selectedOptions[0].textContent : row.querySelector(".qt-name").value.trim();
    return {
      productId: sel.value ? parseInt(sel.value) : null, name,
      qty: parseFloat(row.querySelector(".qt-qty").value)||0,
      price: parseFloat(row.querySelector(".qt-price").value)||0,
      taxPercent: parseFloat(row.querySelector(".qt-tax").value)||0,
    };
  }).filter(i => i.name);
}
async function renderQuotations(){
  const data = await api("/quotations");
  if (!data.ok) return;
  quotesCache = data.quotations;
  const tbody = document.getElementById("quotesTableBody");
  if (!tbody) return;
  tbody.innerHTML = quotesCache.map(q => `
    <tr>
      <td>${escapeHtml(q.quote_number)}</td>
      <td>${escapeHtml(q.client_name)}</td>
      <td>${money(q.total)}</td>
      <td><span class="pill ${q.status==='converted'?'paid':q.status==='draft'?'unpaid':'partial'}">${escapeHtml(q.status)}</span></td>
      <td>${escapeHtml(q.valid_until||"")}</td>
      <td>
        ${q.status !== 'converted' ? `<button class="btn btn-ghost btn-sm" onclick="convertQuote(${q.id})">To invoice</button>` : ""}
        <button class="btn btn-danger btn-sm" onclick="deleteQuote(${q.id})">Delete</button>
      </td>
    </tr>`).join("");
  document.getElementById("quotesEmpty").style.display = quotesCache.length ? "none" : "block";
}
document.getElementById("openAddQuote")?.addEventListener("click", async () => {
  await renderProducts();
  const cdata = await api("/clients");
  const sel = document.getElementById("qtClientSelect");
  sel.innerHTML = '<option value="">Walk-in</option>' + (cdata.clients||[]).map(c =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");
  document.getElementById("quoteForm").reset();
  document.getElementById("qtNumber").value = "QT-" + Date.now().toString().slice(-6);
  document.getElementById("qtItemsBuilder").innerHTML = "";
  addQtItemRow();
  openModal("quoteModal");
});
document.getElementById("qtClientSelect")?.addEventListener("change", e => {
  const opt = e.target.selectedOptions[0];
  if (opt && opt.value) document.getElementById("qtClient").value = opt.textContent;
});
document.getElementById("addQtItemRow")?.addEventListener("click", () => addQtItemRow());
document.getElementById("quoteForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const items = collectQtItems();
  const msg = document.getElementById("quoteFormMsg");
  if (!items.length) { msg.textContent = "Add items"; msg.className = "msg error"; return; }
  const data = await api("/quotations", { method: "POST", body: {
    quoteNumber: document.getElementById("qtNumber").value.trim(),
    clientId: document.getElementById("qtClientSelect").value ? parseInt(document.getElementById("qtClientSelect").value) : null,
    clientName: document.getElementById("qtClient").value.trim(),
    discount: parseFloat(document.getElementById("qtDiscount").value)||0,
    notes: document.getElementById("qtNotes").value.trim(),
    validUntil: document.getElementById("qtValid").value,
    items,
  }});
  if (!data.ok) { msg.textContent = data.error || "Failed"; msg.className = "msg error"; return; }
  closeModal("quoteModal");
  renderQuotations();
});
async function convertQuote(id){
  if (!confirm("Convert this quotation to an invoice? Stock will be deducted.")) return;
  const data = await api(`/quotations/${id}/convert`, { method: "POST" });
  if (!data.ok) { alert(data.error || "Failed"); return; }
  alert("Created invoice " + data.invoiceNumber);
  renderQuotations(); renderInvoices(); renderProducts(); renderOverview();
}
async function deleteQuote(id){
  if (!confirm("Delete quotation?")) return;
  await api(`/quotations/${id}`, { method: "DELETE" });
  renderQuotations();
}

// =========================================================================
// INVENTORY UI
// =========================================================================
async function renderInventory(){
  await renderProducts();
  const sel = document.getElementById("adjProduct");
  if (sel) {
    sel.innerHTML = (productsCache||[]).map(p =>
      `<option value="${p.id}" data-has-variants="${p.has_variants?1:0}">${escapeHtml(p.name)} (stock ${p.stock})${p.has_variants?" · variants":""}</option>`).join("");
    sel.onchange = () => loadAdjVariants();
    loadAdjVariants();
  }
  const mov = await api("/inventory/movements?limit=50");
  const tbody = document.getElementById("movementsTableBody");
  if (tbody && mov.ok) {
    tbody.innerHTML = (mov.movements||[]).map(m => `
      <tr>
        <td>${m.created_at ? new Date(m.created_at.replace(' ','T')+'Z').toLocaleString() : ""}</td>
        <td>${escapeHtml(m.product_name)}</td>
        <td class="credit-amount ${m.delta>=0?'pos':'neg'}">${m.delta>=0?'+':''}${m.delta}</td>
        <td>${escapeHtml(m.reason)}</td>
        <td>${m.balance_after}</td>
      </tr>`).join("");
  }
  const exp = await api("/batches/expiring?days=30");
  const eb = document.getElementById("expiringBatchesBody");
  if (eb && exp.ok) {
    eb.innerHTML = (exp.batches||[]).map(b => `
      <tr><td>${escapeHtml(b.product_name)}</td><td>${escapeHtml(b.batch_number)}</td>
      <td>${b.qty}</td><td>${escapeHtml(b.expiry_date)}</td></tr>`).join("") || '<tr><td colspan="4">None expiring soon</td></tr>';
  }
}
async function loadAdjVariants(){
  const pid = parseInt(document.getElementById("adjProduct")?.value, 10);
  const wrap = document.getElementById("adjVariantWrap");
  const vsel = document.getElementById("adjVariant");
  if (!wrap || !vsel || !pid) return;
  const p = (productsCache||[]).find(x => x.id === pid);
  if (!p || !p.has_variants) {
    wrap.style.display = "none";
    vsel.innerHTML = '<option value="">Parent product stock</option>';
    return;
  }
  const d = await api(`/products/${pid}/variants`);
  const vars = (d && d.ok && d.variants) ? d.variants : [];
  if (!vars.length) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";
  vsel.innerHTML = '<option value="">Parent product stock</option>' + vars.map(v =>
    `<option value="${v.id}">${escapeHtml(v.name||"Variant")} · stock ${v.stock??0}${v.sku?" · "+escapeHtml(v.sku):""}</option>`
  ).join("");
}
document.getElementById("stockAdjustForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("adjMsg");
  const variantId = parseInt(document.getElementById("adjVariant")?.value || "", 10) || null;
  const data = await api("/inventory/adjust", { method: "POST", body: {
    productId: parseInt(document.getElementById("adjProduct").value),
    variantId: variantId || undefined,
    delta: parseFloat(document.getElementById("adjDelta").value),
    reason: document.getElementById("adjReason").value.trim() || "Manual adjust",
  }});
  if (!data.ok) { msg.textContent = data.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = (variantId ? "Variant stock is now " : "Stock is now ") + data.stock; msg.className = "msg success";
  renderInventory(); renderProducts();
});

// =========================================================================
// VARIANTS + BATCHES
// =========================================================================
let vbProductId = null;
async function openVariants(productId){
  vbProductId = productId;
  const p = productsCache.find(x => x.id === productId);
  document.getElementById("vbTitle").textContent = "Variants & batches — " + (p ? p.name : productId);
  document.getElementById("vbProductId").value = productId;
  await refreshVariants();
  await refreshBatches();
  openModal("variantBatchModal");
}
async function refreshVariants(){
  const data = await api(`/products/${vbProductId}/variants`);
  const tbody = document.getElementById("variantsBody");
  if (!tbody || !data.ok) return;
  tbody.innerHTML = (data.variants||[]).map(v => `
    <tr><td>${escapeHtml(v.name)}</td><td>${escapeHtml(v.sku)}</td><td>${escapeHtml(v.barcode)}</td>
    <td>${v.price != null ? money(v.price) : "—"}</td>
    <td>${v.cost_price != null ? money(v.cost_price) : "—"}</td>
    <td>${v.stock}</td>
    <td><button class="btn btn-danger btn-sm" onclick="deleteVariant(${v.id})">Delete</button></td></tr>`).join("");
}
async function refreshBatches(){
  const data = await api(`/products/${vbProductId}/batches`);
  const tbody = document.getElementById("batchesBody");
  if (!tbody || !data.ok) return;
  tbody.innerHTML = (data.batches||[]).map(b => `
    <tr><td>${escapeHtml(b.batch_number)}</td><td>${b.qty}</td>
    <td>${escapeHtml(b.expiry_date)}</td><td>${escapeHtml(b.manufactured_date)}</td>
    <td><button class="btn btn-danger btn-sm" onclick="deleteBatch(${b.id})">Delete</button></td></tr>`).join("");
}
document.querySelectorAll("#variantBatchModal .modal-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#variantBatchModal .modal-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const isV = tab.dataset.vtab === "variants";
    document.getElementById("vbVariantsPanel").style.display = isV ? "block" : "none";
    document.getElementById("vbBatchesPanel").style.display = isV ? "none" : "block";
  });
});
document.getElementById("variantForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  await api(`/products/${vbProductId}/variants`, { method: "POST", body: {
    name: document.getElementById("vName").value.trim(),
    sku: document.getElementById("vSku").value.trim(),
    barcode: document.getElementById("vBarcode").value.trim(),
    price: parseFloat(document.getElementById("vPrice").value) || null,
    costPrice: parseFloat(document.getElementById("vCost").value) || null,
    stock: parseInt(document.getElementById("vStock").value) || 0,
  }});
  document.getElementById("variantForm").reset();
  refreshVariants(); renderProducts();
});
document.getElementById("batchForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  await api(`/products/${vbProductId}/batches`, { method: "POST", body: {
    batchNumber: document.getElementById("bBatchNo").value.trim(),
    qty: parseInt(document.getElementById("bQty").value) || 0,
    expiryDate: document.getElementById("bExpiry").value,
    manufacturedDate: document.getElementById("bMfg").value,
    notes: document.getElementById("bBatchNotes").value.trim(),
  }});
  document.getElementById("batchForm").reset();
  refreshBatches(); renderProducts();
});
async function deleteVariant(id){ if(confirm("Delete variant?")){ await api(`/variants/${id}`,{method:"DELETE"}); refreshVariants(); renderProducts(); } }
async function deleteBatch(id){ if(confirm("Delete batch and reverse stock?")){ await api(`/batches/${id}`,{method:"DELETE"}); refreshBatches(); renderProducts(); } }

// =========================================================================
// QR / BARCODE DESIGNER + WATERMARK + SCANNER
// =========================================================================
const WM_LINE1 = "OrbitBills";
const WM_LINE2 = "Powered By TechSerenia";

function applyPermanentWatermark(canvas){
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  // semi-transparent banner at bottom baked into pixels
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillRect(0, h - 28, w, 28);
  ctx.fillStyle = "rgba(11,61,145,0.75)";
  ctx.font = "bold 10px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(WM_LINE1, w/2, h - 16);
  ctx.font = "bold 9px Inter, sans-serif";
  ctx.fillText(WM_LINE2, w/2, h - 5);
  // light diagonal marks
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#0b3d91";
  ctx.font = "bold 11px sans-serif";
  ctx.translate(w/2, h/2);
  ctx.rotate(-0.4);
  for (let y = -h; y < h; y += 36) ctx.fillText(WM_LINE1 + " · " + WM_LINE2, 0, y);
  ctx.restore();
}

async function generateDesignedCode(){
  const type = document.getElementById("codeType").value;
  const payload = document.getElementById("codePayload").value.trim();
  const size = parseInt(document.getElementById("codeSize").value) || 220;
  const fg = document.getElementById("codeFg").value || "#0b3d91";
  const bg = document.getElementById("codeBg").value || "#ffffff";
  const canvas = document.getElementById("codePreviewCanvas");
  const msg = document.getElementById("codeMsg");
  if (!payload) { msg.textContent = "Enter content first."; msg.className = "msg error"; return; }
  try {
    if (type === "qr") {
      canvas.width = size;
      canvas.height = size + 28;
      const tmp = document.createElement("canvas");
      await tsDrawQrToCanvas(tmp, payload, { size: size });
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // recolor if needed by drawing black QR then multiply — keep black QR for scannability
      ctx.drawImage(tmp, 0, 0, size, size);
      if (fg && fg.toLowerCase() !== "#000000" && fg.toLowerCase() !== "#000") {
        // optional tint: leave as black for reliable scans
      }
      ctx.fillStyle = fg;
      ctx.font = "12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(payload.length > 28 ? payload.slice(0, 28) + "…" : payload, size / 2, size + 18);
      ctx.textAlign = "left";
    } else {
      // Code 128 barcode
      drawSimpleBarcode(canvas, payload, { fg: fg, bg: bg, barHeight: Math.max(40, size - 80), showText: true });
      // ensure watermark space
      const pad = document.createElement("canvas");
      pad.width = canvas.width;
      pad.height = canvas.height + 20;
      const pctx = pad.getContext("2d");
      pctx.fillStyle = bg;
      pctx.fillRect(0, 0, pad.width, pad.height);
      pctx.drawImage(canvas, 0, 0);
      canvas.width = pad.width;
      canvas.height = pad.height;
      canvas.getContext("2d").drawImage(pad, 0, 0);
    }
    if (typeof applyPermanentWatermark === "function") applyPermanentWatermark(canvas);
    msg.textContent = "Generated · scannable " + (type === "qr" ? "QR" : "Code 128") + ".";
    msg.className = "msg success";
  } catch (e) {
    msg.textContent = "Generate failed: " + (e.message || e);
    msg.className = "msg error";
    console.warn(e);
  }
}

function downloadCanvasPng(canvas, filename){
  if (!canvas) return;
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename || "code.png";
  a.click();
}

document.getElementById("generateCodeBtn")?.addEventListener("click", generateDesignedCode);
document.getElementById("downloadCodeBtn")?.addEventListener("click", () => {
  const canvas = document.getElementById("codePreviewCanvas");
  const name = (document.getElementById("codeName")?.value || "code").replace(/[^\w\-]+/g, "_");
  downloadCanvasPng(canvas, name + ".png");
});
document.getElementById("downloadBarcodeBtn")?.addEventListener("click", () => {
  downloadCanvasPng(document.getElementById("barcodeCanvas"), "barcode.png");
});
document.getElementById("downloadQrBtn")?.addEventListener("click", () => {
  downloadCanvasPng(document.getElementById("qrCanvas"), "qr.png");
});

function productCodeValue(p){
  return String((p && (p.barcode || p.sku || p.id)) || "").trim();
}

async function renderAllProductCodes(){
  const grid = document.getElementById("allProductCodesGrid");
  const msg = document.getElementById("allCodesMsg");
  if (!grid) return;
  grid.innerHTML = "<p class='hint'>Loading products…</p>";
  try {
    if (typeof renderProducts === "function") await renderProducts();
  } catch(e){}
  let list = productsCache || [];
  if (!list.length && typeof tsGetAll === "function") {
    try { list = await tsGetAll("products") || []; productsCache = list; } catch(e){}
  }
  if (!list.length) {
    grid.innerHTML = "<p class='hint'>No products in IndexedDB yet. Add products first.</p>";
    return;
  }
  grid.innerHTML = "";
  for (const p of list) {
    const code = productCodeValue(p);
    const card = document.createElement("div");
    card.style.cssText = "border:1px solid var(--border);border-radius:12px;padding:10px;background:#fff;text-align:center";
    const title = document.createElement("div");
    title.style.cssText = "font-size:12px;font-weight:600;margin-bottom:6px;min-height:32px";
    title.textContent = p.name || ("#" + p.id);
    const sub = document.createElement("div");
    sub.style.cssText = "font-size:11px;color:var(--slate);margin-bottom:8px;word-break:break-all";
    sub.textContent = code;
    const bc = document.createElement("canvas");
    bc.width = 160; bc.height = 70;
    bc.style.cssText = "width:100%;max-width:160px;height:auto;margin:0 auto 6px;display:block";
    drawSimpleBarcode(bc, code, { barHeight: 42, showText: true });
    const qr = document.createElement("canvas");
    qr.width = 120; qr.height = 120;
    qr.style.cssText = "width:120px;height:120px;margin:0 auto 8px;display:block";
    try { await tsDrawQrToCanvas(qr, code, { size: 120 }); } catch(e){}
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:6px;justify-content:center;flex-wrap:wrap";
    const dlB = document.createElement("button");
    dlB.type = "button"; dlB.className = "btn btn-ghost btn-sm"; dlB.textContent = "Barcode";
    dlB.onclick = () => downloadCanvasPng(bc, (p.sku || p.id || "item") + "-barcode.png");
    const dlQ = document.createElement("button");
    dlQ.type = "button"; dlQ.className = "btn btn-ghost btn-sm"; dlQ.textContent = "QR";
    dlQ.onclick = () => downloadCanvasPng(qr, (p.sku || p.id || "item") + "-qr.png");
    actions.appendChild(dlB); actions.appendChild(dlQ);
    card.appendChild(title); card.appendChild(sub); card.appendChild(bc); card.appendChild(qr); card.appendChild(actions);
    grid.appendChild(card);
  }
  if (msg) { msg.textContent = list.length + " products · codes ready to download"; msg.className = "msg success"; }
}

document.getElementById("showAllProductCodesBtn")?.addEventListener("click", async () => {
  // switch to codes panel if needed
  const nav = document.querySelector('.nav-item[data-panel="codes"]');
  if (nav) nav.click();
  const card = document.getElementById("allProductCodesCard");
  if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
  await renderAllProductCodes();
});
document.getElementById("refreshProductCodesBtn")?.addEventListener("click", () => renderAllProductCodes());
document.getElementById("downloadAllCodesBtn")?.addEventListener("click", async () => {
  const msg = document.getElementById("allCodesMsg");
  if (msg) { msg.textContent = "Preparing downloads…"; msg.className = "msg"; }
  if (typeof renderProducts === "function") await renderProducts();
  const list = productsCache || [];
  // sequential downloads (browsers limit parallel)
  for (const p of list) {
    const code = productCodeValue(p);
    const bc = document.createElement("canvas");
    drawSimpleBarcode(bc, code, { barHeight: 56 });
    downloadCanvasPng(bc, (p.sku || p.id || "item") + "-barcode.png");
    const qr = document.createElement("canvas");
    try {
      await tsDrawQrToCanvas(qr, code, { size: 256 });
      downloadCanvasPng(qr, (p.sku || p.id || "item") + "-qr.png");
    } catch(e){}
    await new Promise(r => setTimeout(r, 120));
  }
  if (msg) { msg.textContent = "Download started for " + list.length + " products (barcode + QR each)."; msg.className = "msg success"; }
});

document.getElementById("printCodeBtn")?.addEventListener("click", () => {
  generateDesignedCode().then(() => window.print());
});
document.getElementById("saveCodeBtn")?.addEventListener("click", async () => {
  const msg = document.getElementById("codeMsg");
  const data = await api("/codes", { method: "POST", body: {
    name: document.getElementById("codeName").value.trim() || "Untitled",
    codeType: document.getElementById("codeType").value,
    payload: document.getElementById("codePayload").value.trim(),
    design: {
      fg: document.getElementById("codeFg").value,
      bg: document.getElementById("codeBg").value,
      size: parseInt(document.getElementById("codeSize").value) || 220,
    },
  }});
  if (!data.ok) { msg.textContent = data.error || "Save failed"; msg.className = "msg error"; return; }
  msg.textContent = "Saved."; msg.className = "msg success";
  renderCodes();
});
async function renderCodes(){
  const data = await api("/codes");
  const tbody = document.getElementById("savedCodesBody");
  if (!tbody || !data.ok) return;
  tbody.innerHTML = (data.codes||[]).map(c => `
    <tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.code_type)}</td><td>${escapeHtml(c.payload)}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="loadSavedCode(${c.id})">Load</button>
      <button class="btn btn-danger btn-sm" onclick="deleteSavedCode(${c.id})">Delete</button>
    </td></tr>`).join("");
  window.__savedCodes = data.codes || [];
}
function loadSavedCode(id){
  const c = (window.__savedCodes||[]).find(x => x.id === id);
  if (!c) return;
  document.getElementById("codeName").value = c.name;
  document.getElementById("codeType").value = c.code_type;
  document.getElementById("codePayload").value = c.payload;
  try {
    const d = JSON.parse(c.design_json || "{}");
    if (d.fg) document.getElementById("codeFg").value = d.fg;
    if (d.bg) document.getElementById("codeBg").value = d.bg;
    if (d.size) document.getElementById("codeSize").value = d.size;
  } catch(e){}
  generateDesignedCode();
}
async function deleteSavedCode(id){
  if (!confirm("Delete saved code?")) return;
  await api(`/codes/${id}`, { method: "DELETE" });
  renderCodes();
}

// Camera scanner (phone browser) + HID keyboard wedge
let scannerStream = null;
let scanBuffer = "";
let scanTimer = null;
document.getElementById("scanInput")?.addEventListener("keydown", e => {
  // USB HID scanners type very fast then often send Enter
  if (e.key === "Enter") {
    e.preventDefault();
    handleScannedCode(document.getElementById("scanInput").value.trim());
    document.getElementById("scanInput").value = "";
  }
});
async function handleScannedCode(code){
  if (!code) return;
  code = String(code).trim();
  const msg = document.getElementById("scanMsg");
  try { if (typeof renderProducts === "function") await renderProducts(); } catch(e){}
  let list = productsCache || [];
  if (!list.length && typeof tsGetAll === "function") {
    try { list = await tsGetAll("products") || []; productsCache = list; } catch(e){}
  }
  let p = list.find(x =>
    (x.barcode && String(x.barcode) === code) ||
    (x.sku && String(x.sku) === code) ||
    String(x.id) === code
  );
  // variants
  if (!p && typeof tsGetAll === "function") {
    try {
      const variants = await tsGetAll("product_variants") || [];
      const v = variants.find(x =>
        (x.barcode && String(x.barcode) === code) ||
        (x.sku && String(x.sku) === code) ||
        String(x.id) === code
      );
      if (v) {
        p = list.find(x => Number(x.id) === Number(v.product_id)) || {
          id: v.product_id, name: (v.name || "Variant") + " (variant)", stock: v.stock, price: v.price, barcode: v.barcode, sku: v.sku
        };
      }
    } catch(e){}
  }
  if (p) {
    msg.textContent = `Found: ${p.name} · stock ${p.stock} · price ${money(p.price)} · code ${code}`;
    msg.className = "msg success";
    document.getElementById("codePayload").value = code;
    try { await showBarcode(p.id); } catch(e){}
  } else {
    msg.textContent = `No product for "${code}" in IndexedDB. Payload placed in designer — Generate to create a code.`;
    msg.className = "msg";
    document.getElementById("codePayload").value = code;
  }
}
document.getElementById("openScannerBtn")?.addEventListener("click", async () => {
  const wrap = document.getElementById("scannerVideoWrap");
  const video = document.getElementById("scannerVideo");
  const msg = document.getElementById("scanMsg");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    msg.textContent = "Camera not available in this browser."; msg.className = "msg error"; return;
  }
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = scannerStream;
    await video.play();
    wrap.style.display = "block";
    msg.textContent = "Camera on — point at a barcode/QR. Uses BarcodeDetector if available.";
    msg.className = "msg";
    runBarcodeDetectorLoop(video, msg);
  } catch (e) {
    msg.textContent = "Camera permission denied or unavailable: " + e.message;
    msg.className = "msg error";
  }
});
document.getElementById("stopScannerBtn")?.addEventListener("click", () => {
  if (scannerStream) scannerStream.getTracks().forEach(t => t.stop());
  scannerStream = null;
  document.getElementById("scannerVideoWrap").style.display = "none";
});
async function runBarcodeDetectorLoop(video, msg){
  if (!window.BarcodeDetector) {
    msg.textContent += " BarcodeDetector API not supported — use USB HID field or generate codes only.";
    return;
  }
  const detector = new BarcodeDetector({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a"] });
  const loop = async () => {
    if (!scannerStream) return;
    try {
      const codes = await detector.detect(video);
      if (codes && codes[0] && codes[0].rawValue) {
        handleScannedCode(codes[0].rawValue);
        // brief pause after hit
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {}
    if (scannerStream) requestAnimationFrame(() => loop());
  };
  loop();
}

// Enhance showBarcode watermark for product barcodes
const _origShowBarcode = window.showBarcode;
window.showBarcode = async function(productId){
  if (typeof _origShowBarcode === "function") await _origShowBarcode(productId);
  // re-apply watermark on both canvases if present
  const bc = document.getElementById("barcodeCanvas");
  const qr = document.getElementById("qrCanvas");
  if (bc) {
    // extend canvas for watermark strip
    const tmp = document.createElement("canvas");
    tmp.width = bc.width; tmp.height = bc.height + 24;
    tmp.getContext("2d").drawImage(bc, 0, 0);
    bc.width = tmp.width; bc.height = tmp.height;
    bc.getContext("2d").drawImage(tmp, 0, 0);
    applyPermanentWatermark(bc);
  }
  if (qr) {
    const tmp = document.createElement("canvas");
    tmp.width = qr.width; tmp.height = qr.height + 24;
    tmp.getContext("2d").drawImage(qr, 0, 0);
    qr.width = tmp.width; qr.height = tmp.height;
    qr.getContext("2d").drawImage(tmp, 0, 0);
    applyPermanentWatermark(qr);
  }
};



async function renderShifts(){
  const d = await api("/shifts");
  const tbody = document.getElementById("shiftsBody");
  if (!tbody || !d.ok) return;
  tbody.innerHTML = (d.shifts||[]).map(s => `<tr>
    <td>${s.id}</td><td>${escapeHtml(s.user_email||"")}</td>
    <td>${escapeHtml(s.opened_at||"")}</td><td>${escapeHtml(s.closed_at||"—")}</td>
    <td>${money(s.opening_float)}</td><td>${s.closing_cash!=null?money(s.closing_cash):"—"}</td>
    <td>${s.variance!=null?money(s.variance):"—"}</td>
    <td><span class="pill ${s.status==='open'?'paid':'unpaid'}">${escapeHtml(s.status)}</span></td>
  </tr>`).join("");
}
let _plProductsCache = [];
let _plClientsCache = [];
let _plItemPrices = {}; // productId -> price string

async function renderPriceLists(){
  const d = await api("/price-lists");
  const tbody = document.getElementById("priceListsBody");
  if (!tbody || !d.ok) return;
  tbody.innerHTML = (d.priceLists||[]).map(p => `<tr>
    <td>${escapeHtml(p.name)}</td>
    <td>${(p.items||[]).length}</td>
    <td>${p.clientCount != null ? p.clientCount : (p.clients||[]).length}</td>
    <td style="white-space:nowrap">
      <span class="actions-cell">
      <button class="btn btn-ghost btn-sm" type="button" onclick="openPriceListEditor(${p.id})">Edit</button>
      <button class="btn btn-danger btn-sm" type="button" onclick="deletePriceList(${p.id})">Delete</button>
      ${moreBtn(`onclick="priceListMore(${p.id})"`)}
      </span>
    </td>
  </tr>`).join("") || '<tr><td colspan="4">No lists yet — create one to assign special prices to customers.</td></tr>';
}
async function deletePriceList(id){
  if (!confirm("Delete this price list? Clients will fall back to default product prices.")) return;
  await api(`/price-lists/${id}`, { method: "DELETE" });
  document.getElementById("priceListEditor").style.display = "none";
  renderPriceLists();
}
document.getElementById("openPriceList")?.addEventListener("click", async () => {
  const name = prompt("Price list name");
  if (!name) return;
  const d = await api("/price-lists", { method: "POST", body: { name, items: [] } });
  await renderPriceLists();
  if (d.ok && d.id) openPriceListEditor(d.id);
});
async function priceListMore(id){
  openAdminActions("Price list", "#"+id, [
    { label: "Edit", primary: true, run: () => openPriceListEditor(id) },
    { label: "Delete", danger: true, run: () => deletePriceList(id) },
  ]);
}
async function openPriceListEditor(id){
  const [listRes, prodRes, cliRes] = await Promise.all([
    api(`/price-lists/${id}`),
    api("/products"),
    api("/clients"),
  ]);
  if (!listRes.ok || !listRes.priceList) { alert(listRes.error || "Could not open list"); return; }
  const L = listRes.priceList;
  _plProductsCache = prodRes.products || [];
  _plClientsCache = cliRes.clients || [];
  _plItemPrices = {};
  for (const it of (L.items || [])) {
    _plItemPrices[String(it.product_id)] = String(it.price);
  }
  document.getElementById("plEditorId").value = L.id;
  document.getElementById("plEditorName").value = L.name || "";
  document.getElementById("plEditorNotes").value = L.notes || "";
  document.getElementById("plEditorTitle").textContent = "Edit · " + (L.name || "List");
  document.getElementById("plProductFilter").value = "";
  document.getElementById("plClientFilter").value = "";
  document.getElementById("plEditorMsg").textContent = "";
  document.getElementById("priceListEditor").style.display = "block";
  renderPlItemsTable();
  renderPlClientsBox(L.clients || []);
  document.getElementById("priceListEditor").scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderPlItemsTable(){
  const term = (document.getElementById("plProductFilter")?.value || "").toLowerCase().trim();
  const rows = _plProductsCache.filter(p => {
    if (!term) return true;
    return [p.name, p.sku, p.brand, p.category].join(" ").toLowerCase().includes(term);
  }).slice(0, 200);
  const tbody = document.getElementById("plItemsBody");
  tbody.innerHTML = rows.map(p => {
    const val = _plItemPrices[String(p.id)] != null ? _plItemPrices[String(p.id)] : "";
    return `<tr>
      <td>${escapeHtml(p.name)}<div style="font-size:11px;color:var(--slate)">${escapeHtml(p.sku||"")}</div></td>
      <td>${money(p.price)}</td>
      <td><input type="number" step="0.01" min="0" data-pl-pid="${p.id}" value="${escapeHtml(val)}" placeholder="—" style="width:110px;padding:6px 8px;border:1px solid var(--border);border-radius:8px"></td>
    </tr>`;
  }).join("") || '<tr><td colspan="3">No products</td></tr>';
  tbody.querySelectorAll("input[data-pl-pid]").forEach(inp => {
    inp.addEventListener("change", () => {
      const pid = inp.getAttribute("data-pl-pid");
      if (inp.value === "") delete _plItemPrices[pid];
      else _plItemPrices[pid] = inp.value;
    });
  });
}
function renderPlClientsBox(assigned){
  const assignedIds = new Set((assigned || []).map(c => Number(c.id)));
  // also from cache price_list_id
  const lid = parseInt(document.getElementById("plEditorId").value, 10);
  for (const c of _plClientsCache) {
    if (Number(c.price_list_id) === lid) assignedIds.add(Number(c.id));
  }
  const term = (document.getElementById("plClientFilter")?.value || "").toLowerCase().trim();
  const box = document.getElementById("plClientsBox");
  const rows = _plClientsCache.filter(c => {
    if (!term) return true;
    return [c.name, c.phone, c.email].join(" ").toLowerCase().includes(term);
  });
  box.innerHTML = rows.map(c => `
    <label style="display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:13px;cursor:pointer">
      <input type="checkbox" class="pl-client-cb" value="${c.id}" ${assignedIds.has(Number(c.id)) ? "checked" : ""}>
      <span>${escapeHtml(c.name)}</span>
      <span style="color:var(--slate);font-size:12px">${escapeHtml(c.phone||"")}</span>
    </label>`).join("") || '<p style="color:var(--slate);font-size:13px">No clients yet</p>';
}
document.getElementById("plProductFilter")?.addEventListener("input", renderPlItemsTable);
document.getElementById("plClientFilter")?.addEventListener("input", () => renderPlClientsBox());
document.getElementById("plEditorClose")?.addEventListener("click", () => {
  document.getElementById("priceListEditor").style.display = "none";
});
document.getElementById("plEditorSave")?.addEventListener("click", async () => {
  const msg = document.getElementById("plEditorMsg");
  const id = parseInt(document.getElementById("plEditorId").value, 10);
  const name = document.getElementById("plEditorName").value.trim();
  const notes = document.getElementById("plEditorNotes").value.trim();
  // collect prices from inputs too
  document.querySelectorAll("input[data-pl-pid]").forEach(inp => {
    const pid = inp.getAttribute("data-pl-pid");
    if (inp.value === "") delete _plItemPrices[pid];
    else _plItemPrices[pid] = inp.value;
  });
  const items = Object.entries(_plItemPrices).map(([productId, price]) => ({
    productId: parseInt(productId, 10), price: parseFloat(price) || 0
  })).filter(x => x.productId && x.price >= 0);
  msg.textContent = "Saving…"; msg.className = "msg";
  const d = await api(`/price-lists/${id}`, { method: "PUT", body: { name, notes, items } });
  if (!d.ok) { msg.textContent = d.error || "Save failed"; msg.className = "msg error"; return; }
  // Assignments: checked = assign, unchecked previously on this list = unassign
  const checked = Array.from(document.querySelectorAll(".pl-client-cb:checked")).map(c => parseInt(c.value, 10));
  const unchecked = Array.from(document.querySelectorAll(".pl-client-cb:not(:checked)")).map(c => parseInt(c.value, 10));
  // unassign only those that currently have this list
  const toUnassign = unchecked.filter(cid => {
    const c = _plClientsCache.find(x => Number(x.id) === cid);
    return c && Number(c.price_list_id) === id;
  });
  if (checked.length) await api(`/price-lists/${id}/assign`, { method: "POST", body: { clientIds: checked } });
  if (toUnassign.length) await api(`/price-lists/${id}/unassign`, { method: "POST", body: { clientIds: toUnassign } });
  msg.textContent = "Saved. Billing will use these prices for assigned customers."; msg.className = "msg success";
  renderPriceLists();
  // refresh caches for price_list_id
  const cliRes = await api("/clients");
  _plClientsCache = cliRes.clients || [];
});

async function renderNotifications(){
  const d = await api("/notifications");
  const tbody = document.getElementById("notificationsBody");
  const empty = document.getElementById("notificationsEmpty");
  const badge = document.getElementById("notifNavBadge");
  if (!tbody) return;
  if (!d.ok) { tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(d.error||"Failed")}</td></tr>`; return; }
  let dismissed = [];
  try { dismissed = JSON.parse(localStorage.getItem("ts_dismissed_notifs") || "[]"); } catch (e) {}
  const dismissedSet = new Set(dismissed.map(Number));
  let rows = d.notifications || [];
  rows = rows.filter(n => !dismissedSet.has(Number(n.id)));
  if (badge) {
    badge.textContent = rows.length;
    badge.style.display = rows.length ? "inline-block" : "none";
  }
  tbody.innerHTML = rows.map(n => `<tr>
    <td>${escapeHtml(n.invoice_number||"")}</td>
    <td>${escapeHtml(n.client_name||"")}</td>
    <td><strong style="color:${n.overdue?'var(--red)':'inherit'}">${money(n.outstanding)}</strong></td>
    <td>${escapeHtml(n.due_date||"—")}${n.overdue?' <span class="pill unpaid">Overdue</span>':''}</td>
    <td><span class="pill ${escapeHtml(n.status||"")}">${escapeHtml(n.status||"")}</span></td>
    <td>${n.type === "pay_later" ? '<span class="pill partial">Pay Later</span>' : '<span class="pill unpaid">Unpaid</span>'}</td>
    <td class="actions-cell" style="white-space:nowrap">
      <button class="btn btn-ghost btn-sm" type="button" onclick="notifEdit(${n.id})">Edit</button>
      <button class="btn btn-ghost btn-sm" type="button" onclick="notifResetOutstanding(${n.id})" title="Mark paid / clear outstanding">Reset</button>
      <button class="btn btn-ghost btn-sm" type="button" onclick="notifWriteOff(${n.id})">Write off</button>
      <button class="btn btn-ghost btn-sm" type="button" onclick="notifDismiss(${n.id})">Dismiss</button>
      <button class="btn btn-danger btn-sm" type="button" onclick="notifDeleteInvoice(${n.id})">Delete</button>
      ${moreBtn(`onclick="notifMore(${n.id},'${escapeHtml(n.invoice_number||"").replace(/'/g,"&#39;")}','${escapeHtml(n.client_name||"").replace(/'/g,"&#39;")}',${Number(n.outstanding)||0},'${escapeHtml(n.due_date||"")}','${escapeHtml(n.status||"")}',${n.overdue?1:0})"`)}
    </td>
  </tr>`).join("");
  if (empty) empty.style.display = rows.length ? "none" : "block";
}
function notifMore(id, invNo, client, outstanding, due, status, overdue){
  openAdminActions(invNo || "Notification", client || "", [
    { label: "Edit", primary: true, run: () => notifEdit(id) },
    { label: "Reset outstanding", run: () => notifResetOutstanding(id) },
    { label: "Write off", run: () => notifWriteOff(id) },
    { label: "Details", run: () => openAdminInfo(invNo||"Notification", client||"", [
        {label:"Outstanding", value: money(outstanding)},
        {label:"Due date", value: due||"—"},
        {label:"Status", value: status||"—"},
        {label:"Overdue", value: overdue ? "Yes" : "No"},
      ], [{ label: "Edit", primary: true, run: () => notifEdit(id) }])},
    { label: "Dismiss", run: () => notifDismiss(id) },
    { label: "Delete invoice", danger: true, run: () => notifDeleteInvoice(id) },
  ]);
}
function notifDismiss(id){
  let dismissed = [];
  try { dismissed = JSON.parse(localStorage.getItem("ts_dismissed_notifs") || "[]"); } catch (e) {}
  if (!dismissed.includes(id)) dismissed.push(id);
  localStorage.setItem("ts_dismissed_notifs", JSON.stringify(dismissed));
  renderNotifications();
}
document.getElementById("btnClearDismissedNotif")?.addEventListener("click", () => {
  localStorage.removeItem("ts_dismissed_notifs");
  renderNotifications();
});
async function notifResetOutstanding(id){
  if (!confirm("Reset outstanding — mark this invoice as fully paid (records remaining as cash payment into the open shift)?")) return;
  const d = await api(`/invoices/${id}/status`, { method: "POST", body: { status: "paid", method: "cash" } });
  if (!d.ok) { alert(d.error || "Failed"); return; }
  renderNotifications();
  renderDueInvoices?.();
}
async function notifWriteOff(id){
  if (!confirm("Write off remaining balance? Invoice will be marked paid without recording a payment.")) return;
  const d = await api(`/invoices/${id}/write-off`, { method: "POST", body: {} });
  if (!d.ok) { alert(d.error || "Failed"); return; }
  renderNotifications();
}
async function notifDeleteInvoice(id){
  if (!confirm("Permanently delete this invoice? Stock is not auto-restored.")) return;
  const d = await api(`/invoices/${id}`, { method: "DELETE" });
  if (!d.ok) { alert(d.error || "Failed"); return; }
  renderNotifications();
}
async function notifEdit(id){
  const d = await api(`/invoices/${id}`);
  if (!d.ok || !d.invoice) { alert(d.error || "Not found"); return; }
  const inv = d.invoice;
  document.getElementById("notifEditId").value = inv.id;
  document.getElementById("notifEditTitle").textContent = "Edit · " + (inv.invoice_number || inv.id);
  document.getElementById("notifEditDue").value = (inv.due_date || "").slice(0, 10);
  document.getElementById("notifEditStatus").value = inv.status || "unpaid";
  document.getElementById("notifEditNotes").value = inv.notes || "";
  document.getElementById("notifPayAmt").value = "";
  document.getElementById("notifEditMsg").textContent = "";
  document.getElementById("notifEditCard").style.display = "block";
  document.getElementById("notifEditCard").scrollIntoView({ behavior: "smooth", block: "start" });
}
document.getElementById("notifEditClose")?.addEventListener("click", () => {
  document.getElementById("notifEditCard").style.display = "none";
});
document.getElementById("notifEditSave")?.addEventListener("click", async () => {
  const id = document.getElementById("notifEditId").value;
  const msg = document.getElementById("notifEditMsg");
  msg.textContent = "Saving…"; msg.className = "msg";
  const status = document.getElementById("notifEditStatus").value;
  const method = document.getElementById("notifPayMethod")?.value || "cash";
  const d = await api(`/invoices/${id}/status`, { method: "POST", body: {
    status,
    dueDate: document.getElementById("notifEditDue").value,
    notes: document.getElementById("notifEditNotes").value,
    // When switching to paid, method drives cash-box / UPI shift sync
    method: status === "paid" ? method : undefined,
  }});
  if (!d.ok) { msg.textContent = d.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = status === "paid"
    ? "Saved as paid — payment synced to open cash shift"
    : "Saved";
  msg.className = "msg success";
  renderNotifications();
});
document.getElementById("notifRecordPay")?.addEventListener("click", async () => {
  const id = document.getElementById("notifEditId").value;
  const amt = parseFloat(document.getElementById("notifPayAmt").value) || 0;
  const msg = document.getElementById("notifEditMsg");
  if (amt <= 0) { msg.textContent = "Enter a payment amount"; msg.className = "msg error"; return; }
  msg.textContent = "Recording…"; msg.className = "msg";
  const d = await api(`/invoices/${id}/pay`, { method: "POST", body: {
    amount: amt, method: document.getElementById("notifPayMethod").value,
  }});
  if (!d.ok) { msg.textContent = d.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = "Payment recorded"; msg.className = "msg success";
  document.getElementById("notifPayAmt").value = "";
  renderNotifications();
  if (d.invoice) {
    document.getElementById("notifEditStatus").value = d.invoice.status || "partial";
  }
});
document.getElementById("btnRefreshNotif")?.addEventListener("click", renderNotifications);
setTimeout(() => renderNotifications(), 800);

async function renderDeadstock(){
  const days = document.getElementById("deadstockDays")?.value || "60";
  const d = await api(`/reports/deadstock?days=${days}`);
  const tbody = document.getElementById("deadstockBody");
  const empty = document.getElementById("deadstockEmpty");
  if (!tbody) return;
  if (!d.ok) { tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(d.error||"Failed")}</td></tr>`; return; }
  const rows = d.products || [];
  tbody.innerHTML = rows.map(p => `<tr>
    <td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.sku||"")}</td>
    <td><strong>${p.stock}</strong></td><td>${money(p.price)}</td>
    <td>${p.neverSold ? "Never" : escapeHtml((p.lastSoldAt||"").slice(0,10))}</td>
    <td>${p.daysSinceSale != null ? p.daysSinceSale : "—"}</td>
    <td>${escapeHtml((p.expiry_date||"").slice(0,10))}</td>
  </tr>`).join("");
  if (empty) empty.style.display = rows.length ? "none" : "block";
}
document.getElementById("btnRefreshDeadstock")?.addEventListener("click", renderDeadstock);
document.getElementById("deadstockDays")?.addEventListener("change", renderDeadstock);

async function renderFastMoving(){
  const days = document.getElementById("fastMovingDays")?.value || "30";
  const d = await api(`/reports/fast-moving?days=${days}`);
  const tbody = document.getElementById("fastMovingBody");
  const empty = document.getElementById("fastMovingEmpty");
  if (!tbody) return;
  if (!d.ok) { tbody.innerHTML = `<tr><td colspan="7">${escapeHtml(d.error||"Failed")}</td></tr>`; return; }
  const rows = d.products || [];
  tbody.innerHTML = rows.map((p, i) => `<tr>
    <td>${i + 1}</td>
    <td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.sku||"")}</td>
    <td><strong>${p.soldQty}</strong></td><td>${money(p.revenue)}</td>
    <td>${p.dailyVelocity}</td><td>${p.stock}</td>
  </tr>`).join("");
  if (empty) empty.style.display = rows.length ? "none" : "block";
}
document.getElementById("btnRefreshFastMoving")?.addEventListener("click", renderFastMoving);
document.getElementById("fastMovingDays")?.addEventListener("change", renderFastMoving);


async function renderReorderAdmin(){
  const d = await api("/reorder-suggestions?days=30");
  const tbody = document.getElementById("reorderBody");
  if (!tbody || !d.ok) return;
  tbody.innerHTML = (d.suggestions||[]).map(s => `<tr>
    <td>${escapeHtml(s.name)}</td><td>${s.stock}</td><td>${s.soldLastPeriod}</td>
    <td>${s.dailyVelocity}</td><td><strong>${s.suggestQty}</strong></td>
  </tr>`).join("") || '<tr><td colspan="5">Nothing to reorder</td></tr>';
}
document.getElementById("refreshReorder")?.addEventListener("click", renderReorderAdmin);

async function renderLowStock(){
  const d = await api("/low-stock");
  const tbody = document.getElementById("lowStockBody");
  if (!tbody || !d.ok) return;
  tbody.innerHTML = (d.items||[]).map(p => `<tr>
    <td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.sku||"")}</td><td>${escapeHtml(p.category||"")}</td>
    <td><strong style="color:var(--bad)">${p.stock}</strong></td><td>${p.limit_val}</td><td>${money(p.price)}</td>
  </tr>`).join("") || '<tr><td colspan="6">Nothing low on stock right now.</td></tr>';
  const badge = document.getElementById("lowStockNavBadge");
  if (badge) {
    const n = (d.items||[]).length;
    badge.textContent = n; badge.style.display = n ? "inline-block" : "none";
  }
}
document.getElementById("refreshLowStock")?.addEventListener("click", renderLowStock);

async function renderExpiringBatches(){
  const days = document.getElementById("expiringDays")?.value || 30;
  const d = await api(`/batches/expiring?days=${days}`);
  const tbody = document.getElementById("expiringBody");
  if (!tbody || !d.ok) return;
  tbody.innerHTML = (d.batches||[]).map(b => `<tr>
    <td>${escapeHtml(b.product_name||b.name||"")}</td><td>${escapeHtml(b.batch_number||"")}</td>
    <td>${b.qty}</td><td>${escapeHtml(b.expiry_date||"")}</td><td>${escapeHtml(b.notes||"")}</td>
  </tr>`).join("") || '<tr><td colspan="5">Nothing expiring in this window.</td></tr>';
}
document.getElementById("refreshExpiring")?.addEventListener("click", renderExpiringBatches);
document.getElementById("expiringDays")?.addEventListener("change", renderExpiringBatches);

async function renderReturnsAdmin(){
  const d = await api("/returns");
  const tbody = document.getElementById("returnsBody");
  if (!tbody || !d.ok) return;
  tbody.innerHTML = (d.returns||[]).map(r => `<tr>
    <td>${escapeHtml(r.return_number||"")}</td><td>${escapeHtml(r.client_name||"Walk-in")}</td>
    <td>${(r.items||[]).length}</td><td>${money(r.total)}</td>
    <td>${r.restock ? "Yes" : "No"}</td><td>${r.credit_to_client ? "Yes" : "No"}</td>
    <td>${escapeHtml(r.created_at||"")}</td>
  </tr>`).join("") || '<tr><td colspan="7">No returns recorded yet.</td></tr>';
}
document.getElementById("refreshReturns")?.addEventListener("click", renderReturnsAdmin);

async function renderProfitMargin(){
  const days = document.getElementById("marginDays")?.value || 30;
  const d = await api(`/reports/profit-margin?days=${days}`);
  if (!d.ok) return;
  document.getElementById("marginTotalRevenue").textContent = money(d.totalRevenue);
  document.getElementById("marginTotalCost").textContent = money(d.totalCost);
  document.getElementById("marginTotalMargin").textContent = money(d.totalMargin);
  const tbody = document.getElementById("marginBody");
  const rows = [];
  for (const p of (d.products||[]).filter(p => p.soldQty > 0)) {
    rows.push(`<tr>
      <td><strong>${escapeHtml(p.name)}</strong>${p.variantCount ? ` <span style="color:var(--slate);font-size:11px">(${p.variantCount} variants)</span>` : ""}</td>
      <td>${escapeHtml(p.sku||"")}</td><td>${p.soldQty}</td>
      <td>${money(p.revenue)}</td><td>${money(p.cost)}</td><td>${money(p.margin)}</td>
      <td>${p.marginPct !== null && p.marginPct !== undefined ? p.marginPct + "%" : "—"}</td>
    </tr>`);
    for (const v of (p.variants || []).filter(x => x.soldQty > 0)) {
      rows.push(`<tr style="background:var(--blue-tint-2)">
        <td style="padding-left:24px;color:var(--slate)">↳ ${escapeHtml(v.name)}</td>
        <td>${escapeHtml(v.sku||"")}</td><td>${v.soldQty}</td>
        <td>${money(v.revenue)}</td><td>${money(v.cost)}</td><td>${money(v.margin)}</td>
        <td>${v.marginPct != null ? v.marginPct + "%" : "—"}</td>
      </tr>`);
    }
  }
  tbody.innerHTML = rows.join("") || '<tr><td colspan="7">No sales in this window yet.</td></tr>';
}
document.getElementById("refreshMargin")?.addEventListener("click", renderProfitMargin);
document.getElementById("marginDays")?.addEventListener("change", renderProfitMargin);

async function renderOverrideLog(){
  const d = await api("/price-override/log");
  const tbody = document.getElementById("overrideLogBody");
  const empty = document.getElementById("overrideLogEmpty");
  if (!tbody || !d.ok) return;
  const rows = d.overrides || [];
  tbody.innerHTML = rows.map(o => `<tr>
    <td>${escapeHtml(o.product_name||"")}</td><td>${money(o.old_price)}</td><td>${money(o.new_price)}</td>
    <td>${escapeHtml(o.user_email||"")}</td><td>${escapeHtml(o.reason||"")}</td><td>${escapeHtml(o.created_at||"")}</td>
  </tr>`).join("");
  if (empty) empty.style.display = rows.length ? "none" : "block";
}
document.getElementById("refreshOverrideLog")?.addEventListener("click", renderOverrideLog);

// Show a low-stock count badge in the sidebar as soon as the dashboard loads.
renderLowStock();


// =========================================================================
// DATABASE MANAGEMENT
// =========================================================================
async function renderDatabasePanel(){
  const grid = document.getElementById("dbCountsGrid");
  const data = await api("/database/counts");
  if (!data.ok || !grid) return;
  grid.innerHTML = Object.entries(data.counts).map(([label, count]) => `
    <div class="stat-card"><div class="label">${escapeHtml(label)}</div><div class="value">${count}</div></div>
  `).join("");
  checkDbWipeReady();
}
function checkDbWipeReady(){
  const btn = document.getElementById("dbWipeBtn");
  const input = document.getElementById("dbWipeConfirmInput");
  if (!btn || !input) return;
  const anyChecked = Array.from(document.querySelectorAll(".dbWipeCat")).some(c => c.checked);
  btn.disabled = !(anyChecked && input.value.trim() === "DELETE");
}
document.querySelectorAll(".dbWipeCat").forEach(c => c.addEventListener("change", checkDbWipeReady));
document.getElementById("dbWipeConfirmInput")?.addEventListener("input", checkDbWipeReady);
document.getElementById("dbWipeBtn")?.addEventListener("click", async () => {
  const categories = Array.from(document.querySelectorAll(".dbWipeCat:checked")).map(c => c.value);
  const msg = document.getElementById("dbWipeMsg");
  if (!categories.length) return;
  if (!confirm(`This permanently deletes: ${categories.join(", ")}.\n\nThis cannot be undone. Continue?`)) return;
  msg.textContent = "Deleting..."; msg.className = "msg";
  const data = await api("/database/wipe", { method: "POST", body: {
    categories,
    confirm: document.getElementById("dbWipeConfirmInput").value.trim(),
  }});
  if (!data.ok) { msg.textContent = data.error || "Could not delete that data."; msg.className = "msg error"; return; }
  msg.textContent = "Deleted."; msg.className = "msg success";
  document.getElementById("dbWipeConfirmInput").value = "";
  checkDbWipeReady();
  renderDatabasePanel();
  renderOverview();
});

// ---------- init ----------

async function renderCoupons(){
  const d = await api("/coupons");
  const box = document.getElementById("couponCards");
  if (!box) return;
  if (!d.ok) { box.innerHTML = "<p>Could not load coupons.</p>"; return; }
  const list = d.coupons || [];
  if (!list.length) { box.innerHTML = "<p style='color:var(--slate)'>No coupons yet.</p>"; return; }
  box.innerHTML = list.map(c => `
    <div class="card" style="padding:14px;border:1px solid var(--border);border-radius:12px;background:#fff">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
        <div>
          <div style="font-family:Space Grotesk,sans-serif;font-weight:700;font-size:16px">${escapeHtml(c.code)}</div>
          <div style="font-size:12px;color:var(--slate)">${escapeHtml(c.name||"")}</div>
        </div>
        <span class="pill ${c.active?"paid":"unpaid"}">${c.active?"Active":"Off"}</span>
      </div>
      <div style="margin-top:10px;font-size:13px">
        <div>${c.discount_type === "pct" ? (c.value+"%") : ("₹"+c.value)} off</div>
        <div style="color:var(--slate);font-size:12px">Min ₹${c.min_order||0} · Used ${c.used_count||0}${c.max_uses!=null?(" / "+c.max_uses):""}</div>
        ${c.expires_at?`<div style="color:var(--slate);font-size:12px">Expires ${escapeHtml(c.expires_at)}</div>`:""}
      </div>
      <div style="display:flex;gap:6px;margin-top:12px">
        <span class="actions-cell">
        <button class="btn btn-ghost btn-sm" type="button" onclick="editCoupon(${c.id})">Edit</button>
        <button class="btn btn-danger btn-sm" type="button" onclick="deleteCoupon(${c.id})">Delete</button>
        ${moreBtn(`onclick="couponMore(${c.id})"`)}
        </span>
      </div>
    </div>`).join("");
}
async function deleteCoupon(id){
  if (!confirm("Delete this coupon?")) return;
  await api(`/coupons/${id}`, { method: "DELETE" });
  renderCoupons();
}
async function couponMore(id){
  openAdminActions("Coupon", "#"+id, [
    { label: "Edit", primary: true, run: () => editCoupon(id) },
    { label: "Delete", danger: true, run: () => deleteCoupon(id) },
  ]);
}
async function editCoupon(id){
  const d = await api("/coupons");
  const c = (d.coupons||[]).find(x => x.id === id);
  if (!c) return;
  const name = prompt("Name", c.name||"");
  if (name === null) return;
  const value = prompt("Value", String(c.value));
  if (value === null) return;
  const active = confirm("Keep active?") ? 1 : 0;
  await api(`/coupons/${id}`, { method: "PUT", body: {
    name, value: parseFloat(value), discountType: c.discount_type, minOrder: c.min_order,
    maxUses: c.max_uses, maxDiscount: c.max_discount, expiresAt: c.expires_at, active: !!active
  }});
  renderCoupons();
}
document.getElementById("btnNewCoupon")?.addEventListener("click", async () => {
  const code = prompt("Coupon code");
  if (!code) return;
  const name = prompt("Display name", code) || code;
  const dtype = (prompt("Type: pct or flat", "pct") || "pct").toLowerCase();
  const value = parseFloat(prompt("Value", "10") || "0");
  const minOrder = parseFloat(prompt("Minimum order", "0") || "0");
  const maxUses = prompt("Max uses (blank = unlimited)", "");
  const d = await api("/coupons", { method: "POST", body: {
    code, name, discountType: dtype, value, minOrder,
    maxUses: maxUses === "" ? null : parseInt(maxUses, 10)
  }});
  if (!d.ok) { alert(d.error || "Failed"); return; }
  renderCoupons();
});

async function loadPosPin(){
  const d = await api("/branding");
  if (!d.ok) return;
  const b = d.branding || d;
  const pin = (b.price_override_pin != null ? b.price_override_pin : (b["price_override_pin"]));
  const map = typeof b === "object" && !Array.isArray(b) ? b : {};
  // branding may be key/value object
  const get = (k) => (map[k] != null ? map[k] : "");
  document.getElementById("overridePinInput").value = get("price_override_pin") || "1234";
  document.getElementById("allowOverrideSelect").value = get("allow_price_override") || "yes";
}
document.getElementById("btnSavePosPin")?.addEventListener("click", async () => {
  const msg = document.getElementById("posPinMsg");
  const pin = document.getElementById("overridePinInput").value.trim();
  const allow = document.getElementById("allowOverrideSelect").value;
  const d = await api("/branding", { method: "POST", body: {
    price_override_pin: pin,
    allow_price_override: allow
  }});
  if (!d.ok) { msg.textContent = d.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = "Saved"; msg.className = "msg success";
});



// =========================================================================
// Due invoices + local reminders
// =========================================================================
async function renderDueInvoices(){
  const d = await api("/due-invoices");
  const tbody = document.getElementById("dueInvoicesBody");
  const empty = document.getElementById("dueEmpty");
  if (!tbody || !d.ok) return;
  const rows = d.invoices || [];
  tbody.innerHTML = rows.map(i => `
    <tr>
      <td>${escapeHtml(i.invoice_number)}</td>
      <td>${escapeHtml(i.client_name||"Walk-in")}</td>
      <td>${money(i.total)}</td>
      <td><strong style="color:${i.overdue?'var(--red)':'inherit'}">${money(i.outstanding)}</strong></td>
      <td>${escapeHtml(i.due_date||"")}${i.overdue?' <span class="pill unpaid">Overdue</span>':(i.daysUntil===0?' <span class="pill partial">Today</span>':'')}</td>
      <td><span class="pill ${escapeHtml(i.status)}">${escapeHtml(i.status)}</span></td>
      <td><button class="btn btn-ghost btn-sm" type="button" onclick="viewInvoice(${i.id})">Open</button></td>
    </tr>`).join("");
  if (empty) empty.style.display = rows.length ? "none" : "block";
  const badge = document.getElementById("dueNavBadge");
  if (badge) {
    const n = rows.filter(r => r.overdue || r.daysUntil === 0).length;
    badge.textContent = n; badge.style.display = n ? "inline-block" : "none";
  }
}
document.getElementById("btnRefreshDue")?.addEventListener("click", renderDueInvoices);

function tsDueRemindersEnabled(){
  return localStorage.getItem("ts_due_reminders") === "1";
}
function tsSetDueReminders(on){
  localStorage.setItem("ts_due_reminders", on ? "1" : "0");
}
async function tsCheckDueReminders(){
  if (!tsDueRemindersEnabled()) return;
  try {
    const d = await api("/due-invoices");
    if (!d.ok) return;
    const hot = (d.invoices||[]).filter(i => i.overdue || i.daysUntil === 0);
    const badge = document.getElementById("dueNavBadge");
    if (badge) {
      badge.textContent = hot.length; badge.style.display = hot.length ? "inline-block" : "none";
    }
    if (!hot.length) return;
    const body = hot.slice(0, 5).map(i => `${i.invoice_number}: ${i.client_name||"Walk-in"} · due ${i.due_date}`).join("\n");
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("OrbitBills — due invoices", { body: hot.length + " invoice(s) due or overdue\n" + body, tag: "orbitbills-due" });
    }
  } catch (e) {}
}
document.getElementById("btnEnableDueReminders")?.addEventListener("click", async () => {
  const msg = document.getElementById("dueReminderMsg");
  if (typeof Notification === "undefined") {
    if (msg) { msg.textContent = "Notifications not supported in this browser."; msg.className = "msg error"; }
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    if (msg) { msg.textContent = "Permission denied — enable notifications in browser settings."; msg.className = "msg error"; }
    return;
  }
  tsSetDueReminders(true);
  const toggle = document.getElementById("dueRemindersToggle");
  if (toggle) toggle.checked = true;
  if (msg) { msg.textContent = "Reminders enabled on this device."; msg.className = "msg success"; }
  tsCheckDueReminders();
});
document.getElementById("dueRemindersToggle")?.addEventListener("change", (e) => {
  tsSetDueReminders(e.target.checked);
  const msg = document.getElementById("dueReminderMsg");
  if (msg) { msg.textContent = e.target.checked ? "Reminders on." : "Reminders off."; msg.className = "msg"; }
  if (e.target.checked) tsCheckDueReminders();
});
(function initDueToggle(){
  const toggle = document.getElementById("dueRemindersToggle");
  if (toggle) toggle.checked = tsDueRemindersEnabled();
  setTimeout(() => tsCheckDueReminders(), 1200);
})();


// =========================================================================
// Variants screen (products that have variants)
// =========================================================================
async function renderVariantScreen(){
  const q = (document.getElementById("variantProductSearch")?.value || "").trim();
  const d = await api("/products?has_variants=1" + (q ? "&q=" + encodeURIComponent(q) : ""));
  const tbody = document.getElementById("variantProductsBody");
  const empty = document.getElementById("variantProductsEmpty");
  if (!tbody) return;
  if (!d.ok) { tbody.innerHTML = `<tr><td colspan="6">${escapeHtml(d.error||"Failed")}</td></tr>`; return; }
  const rows = (d.products || []).filter(p => p.has_variants);
  tbody.innerHTML = rows.map(p => `<tr>
    <td><strong>${escapeHtml(p.name)}</strong></td>
    <td>${escapeHtml(p.brand||"")}</td>
    <td>${p.variant_count || 0}</td>
    <td>${p.variant_stock || 0}</td>
    <td>${p.stock || 0}</td>
    <td><button class="btn btn-ghost btn-sm" type="button" onclick="openVariantDetail(${p.id}, '${escapeHtml(p.name).replace(/'/g,"&#39;")}')">View variants</button></td>
  </tr>`).join("");
  if (empty) empty.style.display = rows.length ? "none" : "block";
}
async function openVariantDetail(productId, name){
  const d = await api(`/products/${productId}/variants`);
  const card = document.getElementById("variantDetailCard");
  const tbody = document.getElementById("variantDetailBody");
  if (!card || !tbody) return;
  document.getElementById("variantDetailTitle").textContent = name || ("Product #" + productId);
  document.getElementById("variantDetailMeta").textContent = (d.variants||[]).length + " variant(s)";
  tbody.innerHTML = (d.variants || []).map(v => `<tr>
    <td>${escapeHtml(v.name||"")}</td>
    <td>${escapeHtml(v.sku||"")}</td>
    <td>${escapeHtml(v.barcode||"")}</td>
    <td>${money(v.price)}</td>
    <td>${money(v.cost_price)}</td>
    <td><strong>${v.stock ?? 0}</strong></td>
    <td><button class="btn btn-ghost btn-sm" type="button" onclick="openVariants(${productId})">Manage</button></td>
  </tr>`).join("") || '<tr><td colspan="7">No variants</td></tr>';
  card.style.display = "block";
  card.scrollIntoView({ behavior: "smooth", block: "start" });
}
document.getElementById("btnRefreshVariantsScreen")?.addEventListener("click", renderVariantScreen);
document.getElementById("variantProductSearch")?.addEventListener("input", () => renderVariantScreen());

// =========================================================================
// Cash box / drawings / UPI / day-end
// =========================================================================
async function renderCashbox(){
  const d = await api("/cashbox");
  if (!d.ok) return;
  document.getElementById("cbOpening").textContent = money(d.openingBalance);
  document.getElementById("cbCashSales").textContent = money(d.cashSales);
  document.getElementById("cbDrawings").textContent = money(d.drawingsTotal);
  document.getElementById("cbExpected").textContent = money(d.expectedCash);
  document.getElementById("cbUpiSales").textContent = money(d.upiSales);
  document.getElementById("cbCardSales").textContent = money(d.cardSales);
  document.getElementById("cbOtherSales").textContent = money(d.otherSales);
  document.getElementById("cbOpeningInput").value = d.openingBalance || 0;

  const drawBody = document.getElementById("drawingsBody");
  if (drawBody) {
    drawBody.innerHTML = (d.recentDrawings || []).map(r => `<tr>
      <td>${escapeHtml(String(r.created_at||"").slice(0,19).replace("T"," "))}</td>
      <td>${money(r.amount)}</td>
      <td>${escapeHtml(r.method||"cash")}</td>
      <td>${escapeHtml(r.reason||"")}</td>
      <td>${escapeHtml(r.user_name||r.user_email||"")}</td>
      <td><button class="btn btn-danger btn-sm" type="button" onclick="deleteDrawing(${r.id})">Delete</button></td>
    </tr>`).join("") || '<tr><td colspan="6">No drawings yet</td></tr>';
  }
  const upiBody = document.getElementById("upiAccountsBody");
  if (upiBody) {
    upiBody.innerHTML = (d.upiAccounts || []).map(a => `<tr>
      <td>${escapeHtml(a.name||"")}</td>
      <td style="font-family:IBM Plex Mono,monospace;font-size:12px">${escapeHtml(a.upi_id||"")}</td>
      <td>${escapeHtml(a.bank||"")}</td>
      <td>${money(a.opening_balance)}</td>
      <td><button class="btn btn-danger btn-sm" type="button" onclick="deleteUpiAccount(${a.id})">Delete</button></td>
    </tr>`).join("") || '<tr><td colspan="5">No UPI accounts yet</td></tr>';
  }
}
document.getElementById("btnRefreshCashbox")?.addEventListener("click", renderCashbox);
document.getElementById("btnSaveOpening")?.addEventListener("click", async () => {
  const msg = document.getElementById("cbOpeningMsg");
  const d = await api("/cashbox", { method: "POST", body: {
    openingBalance: parseFloat(document.getElementById("cbOpeningInput").value) || 0,
    notes: document.getElementById("cbOpeningNote").value.trim(),
  }});
  if (!d.ok) { msg.textContent = d.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = "Opening balance saved"; msg.className = "msg success";
  renderCashbox();
});
document.getElementById("btnCashAdjust")?.addEventListener("click", async () => {
  const msg = document.getElementById("cbAdjustMsg");
  const d = await api("/cashbox", { method: "POST", body: {
    adjust: parseFloat(document.getElementById("cbAdjustAmt").value) || 0,
    notes: document.getElementById("cbAdjustNote").value.trim(),
  }});
  if (!d.ok) { msg.textContent = d.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = "Adjustment applied"; msg.className = "msg success";
  document.getElementById("cbAdjustAmt").value = 0;
  renderCashbox();
});
document.getElementById("btnAddDrawing")?.addEventListener("click", async () => {
  const msg = document.getElementById("drawingMsg");
  const d = await api("/drawings", { method: "POST", body: {
    amount: parseFloat(document.getElementById("drawingAmt").value) || 0,
    method: document.getElementById("drawingMethod").value,
    reason: document.getElementById("drawingReason").value.trim() || "Drawing",
  }});
  if (!d.ok) { msg.textContent = d.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = "Drawing recorded"; msg.className = "msg success";
  document.getElementById("drawingAmt").value = 0;
  renderCashbox();
});
async function deleteDrawing(id){
  if (!confirm("Delete this drawing and reverse its cash effect?")) return;
  await api(`/drawings/${id}`, { method: "DELETE" });
  renderCashbox();
}
document.getElementById("btnAddUpi")?.addEventListener("click", async () => {
  const msg = document.getElementById("upiMsg");
  const d = await api("/upi-accounts", { method: "POST", body: {
    name: document.getElementById("upiName").value.trim() || "UPI",
    upiId: document.getElementById("upiId").value.trim(),
    bank: document.getElementById("upiBank").value.trim(),
    openingBalance: parseFloat(document.getElementById("upiOpening").value) || 0,
  }});
  if (!d.ok) { msg.textContent = d.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = "UPI account added"; msg.className = "msg success";
  document.getElementById("upiName").value = "";
  document.getElementById("upiId").value = "";
  renderCashbox();
});
async function deleteUpiAccount(id){
  if (!confirm("Delete this UPI account?")) return;
  await api(`/upi-accounts/${id}`, { method: "DELETE" });
  renderCashbox();
}
document.getElementById("btnDayEnd")?.addEventListener("click", async () => {
  const msg = document.getElementById("deMsg");
  const pre = document.getElementById("deResult");
  msg.textContent = "Matching…"; msg.className = "msg";
  const d = await api("/day-end", { method: "POST", body: {
    countedCash: parseFloat(document.getElementById("deCountedCash").value) || 0,
    countedUpi: parseFloat(document.getElementById("deCountedUpi").value) || 0,
    countedCard: parseFloat(document.getElementById("deCountedCard").value) || 0,
    notes: document.getElementById("deNotes").value.trim(),
    closeShift: !!document.getElementById("deCloseShift").checked,
  }});
  if (!d.ok) { msg.textContent = d.error || "Failed"; msg.className = "msg error"; return; }
  msg.textContent = "Day-end saved"; msg.className = "msg success";
  if (pre) {
    pre.style.display = "block";
    pre.textContent = JSON.stringify(d.reconciliation, null, 2);
  }
  renderCashbox();
});

renderOverview();
