function money(n){ return "₹" + Number(n || 0).toFixed(2); }
function esc(s){ return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function qsPeriod(){
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;
  const p = [];
  if (from) p.push("from=" + encodeURIComponent(from));
  if (to) p.push("to=" + encodeURIComponent(to));
  return p.length ? ("?" + p.join("&")) : "";
}
async function api(path, options){
  options = options || {};
  if (typeof tsRequireRole === "function" && !tsRequireRole("admin", "accountant", "billing")) {
    /* soft: checked below */
  }
  if (false) {
    location.href = "signin.html";
    return { ok: false };
  }
  try { return await tsLocalApi(path, options); }
  catch (e) { return { ok: false, error: e.message || "Error" }; }
}
function setMonth(offset){
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  const fmt = d => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return yy + "-" + mm + "-" + dd;
  };
  document.getElementById("fromDate").value = fmt(start);
  document.getElementById("toDate").value = fmt(end);
}
function downloadText(filename, text, mime){
  const blob = new Blob([text], { type: mime || "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function toCsv(rows, headers){
  const escCell = v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map(h => escCell(r[h])).join(","));
  return lines.join("\n");
}
function setText(id, val){ const el = document.getElementById(id); if (el) el.textContent = val; }


function inPeriod(iso, from, to){
  const d = String(iso || "").slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
function upTo(iso, to){
  const d = String(iso || "").slice(0, 10);
  if (to && d > to) return false;
  return true;
}
async function computeFinancials(){
  const from = document.getElementById("fromDate").value || "";
  const to = document.getElementById("toDate").value || "";
  let invoices = [], products = [], purchases = [], payments = [], drawings = [], returns = [], clients = [], ledger = [];

  // Ensure IndexedDB is ready
  try {
    if (typeof tsOpenDB === "function") await tsOpenDB();
    else if (typeof tsSeedDefaults === "function") await tsSeedDefaults();
  } catch (e) { console.warn("db open", e); }

  async function readStore(name){
    try {
      if (typeof tsGetAllSafe === "function") return await tsGetAllSafe(name) || [];
      if (typeof tsGetAll === "function") return await tsGetAll(name) || [];
    } catch (e) { console.warn("read", name, e); }
    return [];
  }

  try {
    invoices = await readStore("invoices");
    products = await readStore("products");
    clients = await readStore("clients");
    payments = await readStore("payments");
    purchases = await readStore("purchases");
    drawings = await readStore("drawings");
    returns = await readStore("returns");
    ledger = await readStore("cash_ledger");
  } catch (e) { console.warn("computeFinancials data", e); }

  // Fallback via local API if direct stores empty but API works
  if (!invoices.length) {
    try {
      const d = await api("/gst/summary" + qsPeriod());
      if (d && d.ok && d.invoiceCount) {
        // still need line items for COGS — try invoices endpoint
      }
      if (typeof tsLocalApi === "function") {
        const inv = await tsLocalApi("/invoices", { method: "GET" });
        if (inv && inv.invoices) invoices = inv.invoices;
        if (inv && inv.ok && inv.items) invoices = inv.items || invoices;
      }
    } catch (e) {}
  }

  const prodById = {};
  for (const p of products) prodById[p.id] = p;

  const periodInvs = invoices.filter(inv => inPeriod(inv.created_at, from, to));
  const asOfInvs = invoices.filter(inv => upTo(inv.created_at, to || "9999-12-31"));

  let salesGross = 0, salesTaxable = 0, salesTax = 0, discountTotal = 0;
  let paidSales = 0, unpaidBal = 0;
  let cogs = 0;
  const invCount = periodInvs.length;
  for (const inv of periodInvs) {
    const total = Number(inv.total) || 0;
    const tax = Number(inv.tax_amount) || 0;
    const disc = Number(inv.discount) || 0;
    const sub = Number(inv.subtotal) || 0;
    salesGross += total;
    salesTaxable += Math.max(0, sub - disc);
    salesTax += tax;
    discountTotal += disc;
    const paid = Number(inv.amount_paid) || 0;
    const st = String(inv.status || "").toLowerCase();
    if (st === "paid") paidSales += total;
    else unpaidBal += Math.max(0, total - paid);
    const items = inv.items || inv.lines || [];
    for (const it of items) {
      const qty = Number(it.qty) || 0;
      const pid = it.product_id ?? it.productId;
      const p = pid != null ? prodById[pid] : null;
      let cost = 0;
      if (p) cost = Number(p.cost_price ?? p.costPrice ?? p.cost) || 0;
      if (!cost && it.cost != null) cost = Number(it.cost) || 0;
      cogs += qty * cost;
    }
  }

  let returnsTotal = 0;
  for (const r of returns) {
    if (!inPeriod(r.created_at || r.date, from, to)) continue;
    returnsTotal += Number(r.total || r.amount || r.refund_amount) || 0;
  }
  const netSales = Math.max(0, salesGross - returnsTotal);
  const grossProfit = netSales - cogs;

  let purchasesPeriod = 0;
  for (const pu of purchases) {
    if (!inPeriod(pu.created_at, from, to)) continue;
    purchasesPeriod += Number(pu.total) || 0;
  }
  let drawingsPeriod = 0;
  for (const d of drawings) {
    if (!inPeriod(d.created_at, from, to)) continue;
    drawingsPeriod += Number(d.amount) || 0;
  }
  const expenses = drawingsPeriod;
  const netProfit = grossProfit - expenses;

  let inventoryValue = 0;
  for (const p of products) {
    inventoryValue += (Number(p.stock) || 0) * (Number(p.cost_price ?? p.costPrice ?? p.cost) || 0);
  }
  let receivables = 0;
  for (const inv of asOfInvs) {
    const total = Number(inv.total) || 0;
    const paid = Number(inv.amount_paid) || 0;
    const st = String(inv.status || "").toLowerCase();
    if (st === "paid") continue;
    receivables += Math.max(0, total - paid);
  }

  let cash = 0;
  try {
    if (typeof tsGetSetting === "function") {
      cash = Number(await tsGetSetting("cash_opening_balance", "0")) || 0;
    }
  } catch (e) {}
  if (ledger && ledger.length) {
    for (const row of ledger) {
      if (!upTo(row.created_at, to || "9999-12-31")) continue;
      const t = String(row.type || "").toLowerCase();
      const amt = Number(row.amount) || 0;
      if (t === "opening_balance") { cash = amt; continue; }
      if (t === "sale" || t === "cash_sale" || t === "payment" || t === "in" || t === "receipt") cash += Math.abs(amt);
      else if (t === "drawing" || t === "drawings" || t === "out" || t === "expense" || t === "purchase" || t === "adjust") cash -= Math.abs(amt);
      else if (t === "day_end") { /* snapshot */ }
      else cash += amt;
    }
  } else {
    for (const inv of asOfInvs) {
      cash += Number(inv.amount_paid) || 0;
    }
    for (const d of drawings) {
      if (upTo(d.created_at, to || "9999-12-31")) cash -= Number(d.amount) || 0;
    }
  }
  if (cash < 0) cash = 0;

  const gstLiability = salesTax;
  const totalAssets = cash + inventoryValue + receivables;
  const totalLiab = gstLiability;
  const equity = totalAssets - totalLiab;

  return {
    from, to, invCount, salesGross, salesTaxable, salesTax, discountTotal, returnsTotal, netSales,
    cogs, grossProfit, purchasesPeriod, drawingsPeriod, expenses, netProfit,
    paidSales, unpaidBal, cash, inventoryValue, receivables, gstLiability, totalAssets, totalLiab, equity,
    _meta: { productCount: products.length, invoiceTotal: invoices.length }
  };
}

function rowHtml(label, amount, opts){
  opts = opts || {};
  const strong = opts.strong ? "font-weight:700" : "";
  const muted = opts.muted ? "color:var(--slate)" : "";
  const neg = Number(amount) < 0 ? "color:var(--red)" : "";
  const indent = opts.indent ? "padding-left:18px" : "";
  return `<tr><td style="${strong};${muted};${indent}">${label}</td><td style="text-align:right;${strong};${neg}">${money(amount)}</td></tr>`;
}

async function loadPnl(){
  const f = await computeFinancials();
  setText("pnlNetSales", money(f.netSales));
  setText("pnlGross", money(f.grossProfit));
  setText("pnlNet", money(f.netProfit));
  setText("pnlInvCount", f.invCount);
  const body = document.getElementById("pnlBody");
  if (!body) return;
  if (!f.invCount && !(f._meta && f._meta.invoiceTotal)) {
    body.innerHTML = '<tr><td colspan="2" style="color:var(--slate);padding:16px">No invoices in IndexedDB for this period. Open <strong>Billing</strong>, complete a sale, then click <strong>Apply</strong> here. Set <strong>cost price</strong> on products in Admin for accurate COGS / profit.</td></tr>';
    return;
  }
  const lines = [];
  lines.push(rowHtml("Sales (invoice value)", f.salesGross, { strong: true }));
  if (f.returnsTotal) lines.push(rowHtml("Less: Returns / credit notes", -f.returnsTotal, { indent: true }));
  lines.push(rowHtml("Net sales", f.netSales, { strong: true }));
  lines.push(rowHtml("Taxable value (ex-tax)", f.salesTaxable, { muted: true, indent: true }));
  lines.push(rowHtml("Output tax (CGST+SGST)", f.salesTax, { muted: true, indent: true }));
  lines.push(rowHtml("Discounts given", f.discountTotal, { muted: true, indent: true }));
  lines.push(`<tr><td colspan="2" style="height:8px;border:0"></td></tr>`);
  lines.push(rowHtml("Cost of goods sold (cost × qty)", f.cogs));
  lines.push(rowHtml("Gross profit", f.grossProfit, { strong: true }));
  lines.push(`<tr><td colspan="2" style="height:8px;border:0"></td></tr>`);
  lines.push(rowHtml("Purchases in period (stock-in)", f.purchasesPeriod, { muted: true }));
  lines.push(rowHtml("Drawings / owner withdrawals", f.drawingsPeriod));
  lines.push(rowHtml("Total expenses (drawings)", f.expenses));
  lines.push(`<tr><td colspan="2" style="height:8px;border:0"></td></tr>`);
  lines.push(rowHtml("Net profit / (loss)", f.netProfit, { strong: true }));
  body.innerHTML = lines.join("");
}

async function loadProfitStatement(){
  const f = await computeFinancials();
  const body = document.getElementById("profitBody");
  if (!body) return;
  const lines = [];
  lines.push(rowHtml("Revenue (net sales)", f.netSales, { strong: true }));
  lines.push(rowHtml("Cost of goods sold", f.cogs));
  lines.push(rowHtml("Gross profit", f.grossProfit, { strong: true }));
  lines.push(rowHtml("Operating expenses (drawings)", f.expenses));
  lines.push(rowHtml("Net profit", f.netProfit, { strong: true }));
  lines.push(`<tr><td colspan="2" style="height:10px;border:0"></td></tr>`);
  lines.push(rowHtml("Of which collected (paid invoices)", f.paidSales, { muted: true }));
  lines.push(rowHtml("Outstanding on period sales", f.unpaidBal, { muted: true }));
  body.innerHTML = lines.join("");
  const gm = f.netSales > 0 ? ((f.grossProfit / f.netSales) * 100).toFixed(1) + "%" : "—";
  const nm = f.netSales > 0 ? ((f.netProfit / f.netSales) * 100).toFixed(1) + "%" : "—";
  setText("psMargin", gm);
  setText("psNetMargin", nm);
  setText("psAvgTicket", f.invCount ? money(f.netSales / f.invCount) : money(0));
  setText("psPaidUnpaid", money(f.paidSales) + " / " + money(f.unpaidBal));
}

async function loadBalanceSheet(){
  const f = await computeFinancials();
  setText("bsAssets", money(f.totalAssets));
  setText("bsLiab", money(f.totalLiab));
  setText("bsEquity", money(f.equity));
  setText("bsAsOf", f.to || "today");
  const body = document.getElementById("balanceBody");
  if (!body) return;
  const lines = [];
  lines.push(`<tr><td colspan="2" style="font-weight:700;background:var(--blue-tint-2);padding:8px 10px">Assets</td></tr>`);
  lines.push(rowHtml("Cash & bank (estimated)", f.cash, { indent: true }));
  lines.push(rowHtml("Inventory (stock × cost)", f.inventoryValue, { indent: true }));
  lines.push(rowHtml("Accounts receivable (unpaid)", f.receivables, { indent: true }));
  lines.push(rowHtml("Total assets", f.totalAssets, { strong: true }));
  lines.push(`<tr><td colspan="2" style="height:10px;border:0"></td></tr>`);
  lines.push(`<tr><td colspan="2" style="font-weight:700;background:var(--blue-tint-2);padding:8px 10px">Liabilities</td></tr>`);
  lines.push(rowHtml("GST / tax liability (period)", f.gstLiability, { indent: true }));
  lines.push(rowHtml("Total liabilities", f.totalLiab, { strong: true }));
  lines.push(`<tr><td colspan="2" style="height:10px;border:0"></td></tr>`);
  lines.push(`<tr><td colspan="2" style="font-weight:700;background:var(--blue-tint-2);padding:8px 10px">Equity</td></tr>`);
  lines.push(rowHtml("Owner’s equity (balancing figure)", f.equity, { indent: true }));
  lines.push(rowHtml("  includes period net profit", f.netProfit, { muted: true, indent: true }));
  lines.push(rowHtml("Total equity", f.equity, { strong: true }));
  lines.push(`<tr><td colspan="2" style="height:10px;border:0"></td></tr>`);
  lines.push(rowHtml("Liabilities + Equity", f.totalLiab + f.equity, { strong: true }));
  body.innerHTML = lines.join("");
}


async function loadSummary(){
  let d = null;
  try {
    d = await api("/gst/summary" + qsPeriod());
  } catch (e) {
    console.warn("gst summary", e);
  }
  // Fallback: compute from IndexedDB if API empty/failed
  if (!d || !d.ok) {
    try {
      if (typeof tsOpenDB === "function") await tsOpenDB();
      const invoices = (typeof tsGetAll === "function" ? await tsGetAll("invoices") : []) || [];
      const from = document.getElementById("fromDate").value || "";
      const to = document.getElementById("toDate").value || "";
      const inRange = (iso) => {
        const day = String(iso || "").slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      };
      const filtered = invoices.filter(inv => inRange(inv.created_at));
      let totalTaxable = 0, totalTax = 0, totalInvoiceValue = 0;
      for (const inv of filtered) {
        const sub = Number(inv.subtotal) || 0;
        const disc = Number(inv.discount) || 0;
        totalTaxable += Math.max(0, sub - disc);
        totalTax += Number(inv.tax_amount) || 0;
        totalInvoiceValue += Number(inv.total) || 0;
      }
      d = {
        ok: true,
        invoiceCount: filtered.length,
        totalTaxable, totalTax,
        totalCgst: totalTax / 2, totalSgst: totalTax / 2, totalIgst: 0,
        totalInvoiceValue,
        b2b: { count: 0, taxable: 0, tax: 0 },
        b2c: { count: filtered.length, taxable: totalTaxable, tax: totalTax },
        byRate: [],
        _allInvoices: invoices.length,
      };
    } catch (e2) {
      console.warn("gst fallback", e2);
      d = { ok: false };
    }
  }
  if (!d || !d.ok) {
    const hint = document.querySelector("#panel-summary .hint");
    if (hint) hint.textContent = "Could not load GST data. Open Billing, complete a sale, then return here and tap Apply. Data is stored only on this device (IndexedDB).";
    return;
  }
  // If zero in period but invoices exist overall, show helpful note
  try {
    let allCount = d._allInvoices;
    if (allCount == null && typeof tsGetAll === "function") {
      allCount = ((await tsGetAll("invoices")) || []).length;
    }
    const hint = document.querySelector("#panel-summary .hint");
    if (hint && !(d.invoiceCount) && allCount > 0) {
      hint.innerHTML = "No invoices in <strong>this date range</strong>, but this device has <strong>" + allCount + "</strong> invoice(s) overall. Change From/To or tap <strong>This month</strong>, then Apply.";
    } else if (hint && !(d.invoiceCount) && !allCount) {
      hint.innerHTML = "No invoices on this device yet. Create sales in <strong>Billing</strong>, then return here and tap Apply. All figures come from IndexedDB on this phone/browser.";
    }
  } catch (e) {}
  setText("sCount", d.invoiceCount || 0);
  setText("sTaxable", money(d.totalTaxable));
  setText("sTaxPay", money(d.totalTax));
  setText("sTotal", money(d.totalInvoiceValue));
  setText("sCgst", money(d.totalCgst));
  setText("sSgst", money(d.totalSgst));
  setText("sIgst", money(d.totalIgst || 0));
  setText("sB2bCount", (d.b2b && d.b2b.count) || 0);
  setText("sB2bTaxable", money(d.b2b && d.b2b.taxable));
  setText("sB2bTax", money(d.b2b && d.b2b.tax));
  setText("sB2cCount", (d.b2c && d.b2c.count) || 0);
  setText("sB2cTaxable", money(d.b2c && d.b2c.taxable));
  setText("sB2cTax", money(d.b2c && d.b2c.tax));
  const tbody = document.getElementById("ratesBody");
  if (tbody) {
    tbody.innerHTML = (d.byRate || []).map(r => `<tr>
      <td><strong>${r.rate}%</strong></td><td>${money(r.taxable)}</td><td>${money(r.cgst)}</td>
      <td>${money(r.sgst)}</td><td>${money(r.igst)}</td><td><strong>${money(r.tax)}</strong></td><td>${r.lines}</td>
    </tr>`).join("") || '<tr><td colspan="7">No taxable lines in this period.</td></tr>';
  }
}
async function loadHsn(){
  const d = await api("/gst/hsn" + qsPeriod());
  const tbody = document.getElementById("hsnBody");
  if (!tbody) return;
  if (!d || !d.ok) { tbody.innerHTML = `<tr><td colspan="8">${esc((d&&d.error)||"Failed")}</td></tr>`; return; }
  tbody.innerHTML = (d.hsn || []).map(h => `<tr>
    <td>${esc(h.hsn)}</td><td>${esc(h.description)}</td><td>${h.qty}</td><td>${h.rate}%</td>
    <td>${money(h.taxable)}</td><td>${money(h.cgst)}</td><td>${money(h.sgst)}</td><td>${money(h.tax)}</td>
  </tr>`).join("") || '<tr><td colspan="8">No HSN data — add HSN on products.</td></tr>';
}
let lastB2b = [], lastB2c = [];
async function loadB2b(){
  const d = await api("/gst/b2b" + qsPeriod());
  const tbody = document.getElementById("b2bBody");
  if (!tbody || !d || !d.ok) return;
  lastB2b = d.invoices || [];
  tbody.innerHTML = lastB2b.map(i => `<tr>
    <td>${esc(i.invoice_number)}</td><td>${esc(i.date)}</td><td>${esc(i.client_name)}</td>
    <td style="font-family:IBM Plex Mono,monospace;font-size:12px">${esc(i.gstin)}</td>
    <td>${money(i.taxable)}</td><td>${money(i.tax)}</td><td>${money(i.total)}</td>
    <td><span class="pill ${esc(i.status||"")}">${esc(i.status||"")}</span></td>
  </tr>`).join("") || '<tr><td colspan="8">No B2B invoices.</td></tr>';
}
async function loadB2c(){
  const d = await api("/gst/b2c" + qsPeriod());
  const tbody = document.getElementById("b2cBody");
  if (!tbody || !d || !d.ok) return;
  lastB2c = d.invoices || [];
  tbody.innerHTML = lastB2c.map(i => `<tr>
    <td>${esc(i.invoice_number)}</td><td>${esc(i.date)}</td><td>${esc(i.client_name)}</td>
    <td>${money(i.taxable)}</td><td>${money(i.tax)}</td><td>${money(i.total)}</td>
    <td><span class="pill ${esc(i.status||"")}">${esc(i.status||"")}</span></td>
  </tr>`).join("") || '<tr><td colspan="7">No B2C invoices.</td></tr>';
}
async function loadGstr1(){
  const d = await api("/gst/gstr1" + qsPeriod());
  const pre = document.getElementById("gstr1Preview");
  if (!pre) return;
  if (!d || !d.ok) { pre.textContent = (d && d.error) || "Failed"; return; }
  pre.textContent = JSON.stringify(d, null, 2);
  window.__gstr1 = d;
}
async function refreshAll(){
  await loadSummary();
  await loadHsn();
  await loadB2b();
  await loadB2c();
  await loadGstr1();
  await loadPnl();
  await loadProfitStatement();
  await loadBalanceSheet();
}
document.querySelectorAll(".nav-item[data-panel]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-panel]").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const panel = document.getElementById("panel-" + btn.dataset.panel);
    if (panel) panel.classList.add("active");
  });
});
document.getElementById("btnApply").addEventListener("click", refreshAll);
document.getElementById("btnThisMonth").addEventListener("click", () => { setMonth(0); refreshAll(); });
document.getElementById("btnPrevMonth").addEventListener("click", () => { setMonth(-1); refreshAll(); });
document.getElementById("signOutBtn").addEventListener("click", () => { try { tsLogout(); } catch(e) {} location.href = "signin.html"; });
document.getElementById("btnExportGstr1").addEventListener("click", async () => {
  if (!window.__gstr1) await loadGstr1();
  downloadText("gstr1-" + new Date().toISOString().slice(0,10) + ".json", JSON.stringify(window.__gstr1 || {}, null, 2), "application/json");
});
document.getElementById("btnExportGstr1Csv").addEventListener("click", async () => {
  if (!window.__gstr1) await loadGstr1();
  const d = window.__gstr1 || {};
  const stamp = new Date().toISOString().slice(0,10);
  downloadText("gstr1-b2b-" + stamp + ".csv", toCsv((d.b2b||[]).map(i => ({
    invoice_number:i.invoice_number, date:i.date, client_name:i.client_name, gstin:i.gstin,
    taxable:i.taxable, tax:i.tax, total:i.total, status:i.status
  })), ["invoice_number","date","client_name","gstin","taxable","tax","total","status"]), "text/csv");
  downloadText("gstr1-b2c-" + stamp + ".csv", toCsv((d.b2c||[]).map(i => ({
    invoice_number:i.invoice_number, date:i.date, client_name:i.client_name,
    taxable:i.taxable, tax:i.tax, total:i.total, status:i.status
  })), ["invoice_number","date","client_name","taxable","tax","total","status"]), "text/csv");
  downloadText("gstr1-hsn-" + stamp + ".csv", toCsv((d.hsn||[]).map(h => ({
    hsn:h.hsn, description:h.description, qty:h.qty, rate:h.rate,
    taxable:h.taxable, cgst:h.cgst, sgst:h.sgst, tax:h.tax
  })), ["hsn","description","qty","rate","taxable","cgst","sgst","tax"]), "text/csv");
});
document.getElementById("btnExportB2bCsv").addEventListener("click", () => {
  downloadText("b2b-" + new Date().toISOString().slice(0,10) + ".csv", toCsv(lastB2b, ["invoice_number","date","client_name","gstin","taxable","tax","total","status"]), "text/csv");
});
document.getElementById("btnExportB2cCsv").addEventListener("click", () => {
  downloadText("b2c-" + new Date().toISOString().slice(0,10) + ".csv", toCsv(lastB2c, ["invoice_number","date","client_name","taxable","tax","total","status"]), "text/csv");
});
(function initChecklist(){
  const key = "ts_gst_checklist";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
  document.querySelectorAll(".file-check").forEach((el, i) => {
    el.checked = !!saved[i];
    el.addEventListener("change", () => {
      const out = {};
      document.querySelectorAll(".file-check").forEach((c, j) => { out[j] = c.checked; });
      localStorage.setItem(key, JSON.stringify(out));
      const msg = document.getElementById("checkMsg");
      if (msg) { msg.textContent = "Saved on this device"; msg.className = "msg ok"; }
    });
  });
})();
(async function init(){
  try { await tsSeedDefaults(); } catch (e) {}
  var who = { ok: false };
  try { who = (typeof tsWhoami === "function" ? tsWhoami() : null) || { ok: false }; } catch (e) { who = { ok: false }; }
  // Any valid session can open Accountant (Change panel)
  if (!who || !who.ok) {
    location.href = "signin.html";
    return;
  }
  setText("whoLabel", (who.name || who.email || "") + " · " + who.role);
  try { if (typeof tsOpenDB === "function") await tsOpenDB(); } catch (e) {}
  try { if (typeof tsSeedDefaults === "function") await tsSeedDefaults(); } catch (e) {}
  setMonth(0);
  await refreshAll();
})();
