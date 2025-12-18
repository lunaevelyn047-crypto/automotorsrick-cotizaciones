const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");


const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function pad2(x) {
  return String(x).padStart(2, "0");
}

function formatDateDDMMYYYY(isoOrDate) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function renderHTML(data) {
  const {
    cliente = "",
    fecha = new Date().toISOString(),
    vigencia = "1 DÍA",
    items = [],
    aplicarIva = true,
    costoEnvio = 0,
    tallerNombre = "AUTOMOTORSRICK",
    tecnicoNombre = "TÉCNICO: Uriel Alejandro Martínez",
  } = data || {};

  const subtotal = items.reduce(
    (acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio || 0),
    0
  );
  const envio = Number(costoEnvio || 0);
  const iva = aplicarIva ? subtotal * 0.16 : 0;
  const total = subtotal + envio + iva;

  const rows = items
    .map((it) => {
      const cant = Number(it.cantidad || 0);
      const precio = Number(it.precio || 0);
      const totalRow = cant * precio;

      return `
      <tr>
        <td class="code">${(it.codigo || "").toString()}</td>
        <td class="desc">${(it.descripcion || "").toString()}</td>
        <td class="qty">${cant || ""}</td>
        <td class="price">${money(precio)}</td>
        <td class="lineTotal">${money(totalRow)}</td>
      </tr>
    `;
    })
    .join("");

  return `
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Cotización</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111; font-size: 12px; }
  .sheet { width: 100%; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px; }
  .brand { font-weight: 700; font-size: 14px; letter-spacing: .5px; }
  .tech { margin-top: 4px; font-size: 11px; }
  .meta { width: 55%; }
  .metaRow { display:flex; gap: 12px; margin: 4px 0; }
  .label { width: 80px; font-weight:700; }
  .value { flex:1; }
  .line { border-bottom: 2px solid #cfcfcf; margin: 8px 0 12px; }

  table { width:100%; border-collapse: collapse; }
  thead th { text-align:left; padding: 8px 6px; border-bottom: 2px solid #cfcfcf; font-weight: 700; }
  tbody td { padding: 10px 6px; border-bottom: 1px solid #e2e2e2; vertical-align: top; }
  .code { width: 18%; color:#222; }
  .desc { width: 52%; }
  .qty { width: 10%; text-align:center; }
  .price, .lineTotal { width: 10%; text-align:right; white-space: nowrap; }

  .summary { margin-top: 18px; width: 45%; margin-left:auto; }
  .sumRow { display:flex; justify-content:space-between; padding: 6px 0; }
  .sumRow .k { color:#222; }
  .sumRow .v { font-weight:700; white-space:nowrap; }
  .muted { color:#666; font-weight: 400; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="brand">${tallerNombre}</div>
        <div class="tech">${tecnicoNombre}</div>
      </div>

      <div class="meta">
        <div class="metaRow">
          <div class="label">CLIENTE:</div>
          <div class="value">${cliente}</div>
        </div>
        <div class="metaRow">
          <div class="label">FECHA:</div>
          <div class="value">${formatDateDDMMYYYY(fecha)}</div>
          <div class="label" style="width:90px;">VIGENCIA:</div>
          <div class="value">${vigencia}</div>
        </div>
      </div>
    </div>

    <div class="line"></div>

    <table>
      <thead>
        <tr>
          <th>Cód. artículo</th>
          <th>Descripción</th>
          <th style="text-align:center;">Cantidad</th>
          <th style="text-align:right;">Precio</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="5" class="muted">Sin partidas</td></tr>`}
      </tbody>
    </table>

    <div class="summary">
      <div class="sumRow"><div class="k">Subtotal</div><div class="v">${money(
        subtotal
      )}</div></div>
      <div class="sumRow"><div class="k">Costo Envío</div><div class="v">${money(
        envio
      )}</div></div>
      <div class="sumRow"><div class="k">IVA</div><div class="v">${money(
        iva
      )}</div></div>
      <div class="sumRow" style="border-top:1px solid #e2e2e2; margin-top:6px; padding-top:10px;">
        <div class="k">Total</div><div class="v">${money(total)}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

app.post("/api/pdf", async (req, res) => {
  try {
    const html = renderHTML(req.body);

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="cotizacion.pdf"'
    );
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Error generando PDF" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => console.log(`PDF server en puerto ${PORT}`));
