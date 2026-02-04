const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const app = express();

/* ============================
   ✅ CORS CONFIGURACIÓN CORRECTA
   ============================ */
const allowedOrigins = [
  process.env.CORS_ORIGIN, // https://automotorsrick-cotizaciones.vercel.app
  "http://localhost:5173", // Vite local
  "http://localhost:3000", // opcional
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite Postman, móvil, descargas directas
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS bloqueado para este origen: " + origin),
        false
      );
    },
  })
);

app.use(express.json({ limit: "2mb" }));

/* ============================
   UTILIDADES
   ============================ */
function money(n) {
  const v = Number(n || 0);
  return v.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

function pad2(x) {
  return String(x).padStart(2, "0");
}

function formatDateDDMMYYYY(isoOrDate) {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/* ============================
   HTML DEL PDF
   ============================ */
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
        <td>${it.codigo || ""}</td>
        <td>${it.descripcion || ""}</td>
        <td style="text-align:center;">${cant}</td>
        <td style="text-align:right;">${money(precio)}</td>
        <td style="text-align:right;">${money(totalRow)}</td>
      </tr>
    `;
    })
    .join("");

  return `
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Cotización</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
  table { width:100%; border-collapse: collapse; }
  th, td { padding: 8px; border-bottom: 1px solid #ddd; }
  th { text-align:left; }
  .totals { width:40%; margin-left:auto; margin-top:20px; }
</style>
</head>
<body>

<h2>${tallerNombre}</h2>
<div>${tecnicoNombre}</div>

<p>
<b>Cliente:</b> ${cliente}<br>
<b>Fecha:</b> ${formatDateDDMMYYYY(fecha)}<br>
<b>Vigencia:</b> ${vigencia}
</p>

<table>
<thead>
<tr>
<th>Código</th>
<th>Descripción</th>
<th>Cant.</th>
<th>Precio</th>
<th>Total</th>
</tr>
</thead>
<tbody>
${rows || `<tr><td colspan="5">Sin partidas</td></tr>`}
</tbody>
</table>

<div class="totals">
<p>Subtotal: <b>${money(subtotal)}</b></p>
<p>Costo envío: <b>${money(envio)}</b></p>
<p>IVA: <b>${money(iva)}</b></p>
<p>Total: <b>${money(total)}</b></p>
</div>

</body>
</html>
`;
}

/* ============================
   ENDPOINT PDF (ANTI MEMORY LEAK)
   ============================ */
app.post("/api/pdf", async (req, res) => {
  let browser;
  let page;

  try {
    const html = renderHTML(req.body);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="cotizacion.pdf"'
    );

    res.send(pdf);
  } catch (err) {
    console.error("PDF error:", err);
    res.status(500).json({ error: "Error generando PDF" });
  } finally {
    // 🔥 CLAVE: liberar memoria SIEMPRE
    try { if (page) await page.close(); } catch (_) {}
    try { if (browser) await browser.close(); } catch (_) {}
  }
});

/* ============================
   SERVER
   ============================ */
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`PDF server en puerto ${PORT}`)
);
