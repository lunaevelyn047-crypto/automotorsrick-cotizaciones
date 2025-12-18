import { useMemo, useState } from "react";
import "./styles.css";

const money = (n) =>
  Number(n || 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });

const pad2 = (x) => String(x).padStart(2, "0");
const todayDDMMYYYY = () => {
  const d = new Date();
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
};

// ✅ Input: mostrar coma de miles automáticamente (1,359.80)
const formatInputWithCommas = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  if (!isFinite(n)) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseInputToNumber = (text) => {
  if (text === "" || text === null || text === undefined) return 0;
  const cleaned = String(text).replace(/,/g, "").trim();
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
};

export default function App() {
  const [cliente, setCliente] = useState("");
  const [vigencia, setVigencia] = useState("1 DÍA");
  const [fecha] = useState(todayDDMMYYYY());
  const [aplicarIva, setAplicarIva] = useState(true);
  const [costoEnvio, setCostoEnvio] = useState(0);

  // ✅ precioUI: lo que se ve en el input (con comas)
  // ✅ precio: número real (para cálculos y PDF)
  const [items, setItems] = useState([
    { codigo: "", descripcion: "", cantidad: 1, precio: 0, precioUI: "" },
  ]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio || 0),
        0
      ),
    [items]
  );

  const iva = aplicarIva ? subtotal * 0.16 : 0;
  const total = subtotal + Number(costoEnvio || 0) + iva;

  const updateItem = (idx, key, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  };

  const addRow = () =>
    setItems((prev) => [
      ...prev,
      { codigo: "", descripcion: "", cantidad: 1, precio: 0, precioUI: "" },
    ]);

  const removeRow = (idx) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  // ✅ Generar PDF (local por ahora)
  const generarPDF = async () => {
    try {
      const payload = {
        tallerNombre: "AUTOMOTORSRICK",
        tecnicoNombre: "TÉCNICO: Uriel Alejandro Martínez",
        cliente,
        vigencia,
        fecha: new Date().toISOString(),
        aplicarIva,
        costoEnvio,

        // ✅ mandamos SOLO lo necesario (sin precioUI) y sin warnings de ESLint
        items: items.map((it) => ({
          codigo: it.codigo,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio: it.precio,
        })),
      };

      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

      const r = await fetch(`${API_URL}/api/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        alert(
          "No se pudo generar el PDF. Backend configurado: ${API_URL}\n\nRevisa que Render esté en Live y que CORS_ORIGIN tenga tu dominio de Vercel."
        );
        return;
      }

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "cotizacion.pdf";
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(
        "Error al generar el PDF. Revisa que el backend esté encendido y sin errores."
      );
    }
  };

  // ✅ formatear precio al salir o presionar enter
  const commitPrecioFormat = (idx) => {
    const it = items[idx];
    const num = Number(it?.precio || 0);
    updateItem(idx, "precioUI", num === 0 ? "" : formatInputWithCommas(num));
  };

  return (
    <div className="page">
      <div className="card">
        <h2>AutomotorsRick – Cotización</h2>

        <div className="grid">
          <label>
            Cliente
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nombre del cliente"
            />
          </label>

          <label>
            Fecha (auto)
            <input value={fecha} readOnly />
          </label>

          <label>
            Vigencia
            <input
              value={vigencia}
              onChange={(e) => setVigencia(e.target.value)}
            />
          </label>

          <label className="row">
            <input
              type="checkbox"
              checked={aplicarIva}
              onChange={(e) => setAplicarIva(e.target.checked)}
            />
            Aplicar IVA (16%)
          </label>

          <label>
            Costo envío
            <input
              type="number"
              value={Number(costoEnvio) === 0 ? "" : costoEnvio}
              placeholder="0.00"
              onFocus={(e) => e.target.select()}
              onChange={(e) =>
                setCostoEnvio(
                  e.target.value === "" ? 0 : Number(e.target.value)
                )
              }
            />
          </label>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Descripción</th>
                <th>Cant.</th>
                <th>Precio</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {items.map((it, idx) => {
                const lineTotal =
                  Number(it.cantidad || 0) * Number(it.precio || 0);

                return (
                  <tr key={idx}>
                    <td>
                      <input
                        value={it.codigo}
                        onChange={(e) =>
                          updateItem(idx, "codigo", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <input
                        value={it.descripcion}
                        onChange={(e) =>
                          updateItem(idx, "descripcion", e.target.value)
                        }
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        value={it.cantidad}
                        onChange={(e) =>
                          updateItem(idx, "cantidad", Number(e.target.value))
                        }
                      />
                    </td>

                    {/* ✅ PRECIO: escribe normal, y al salir se formatea con coma */}
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={it.precioUI}
                        placeholder="0.00"
                        onFocus={(e) => {
                          updateItem(
                            idx,
                            "precioUI",
                            it.precio ? String(it.precio) : ""
                          );
                          setTimeout(() => e.target.select(), 0);
                        }}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^\d.,]/g, "");
                          updateItem(idx, "precioUI", v);
                          updateItem(idx, "precio", parseInputToNumber(v));
                        }}
                        onBlur={() => commitPrecioFormat(idx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitPrecioFormat(idx);
                            e.target.blur();
                          }
                        }}
                      />
                    </td>

                    <td className="right">{money(lineTotal)}</td>

                    <td>
                      <button
                        className="danger"
                        onClick={() => removeRow(idx)}
                        disabled={items.length === 1}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="totals">
          <div>
            Subtotal: <b>{money(subtotal)}</b>
          </div>
          <div>
            IVA: <b>{money(iva)}</b>
          </div>
          <div>
            Total: <b>{money(total)}</b>
          </div>
        </div>

        <div className="actions">
          <button onClick={addRow}>+ Agregar partida</button>
          <button className="primary" onClick={generarPDF}>
            Generar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
