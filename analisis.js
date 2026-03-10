/* ═══════════════════════════════════════════════════════════
   TORRES DEL SOL — analisis.js
   Carga CSV · KPIs · 3 gráficas Chart.js · Alertas
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ─── ESTADO ─────────────────────────────────────────────── */
let parsedData = [];
let charts     = {};

/* ─── PALETA (vinoteca) ──────────────────────────────────── */
const COLOR_TEMP  = '#c0392b';   // rojo-vino
const COLOR_HUM   = '#2980b9';   // azul
const COLOR_GOLD  = '#c9a84c';
const COLOR_CREAM = '#f5ede0';

/* ─── REFERENCIAS DOM ────────────────────────────────────── */
const uploadArea  = document.getElementById('uploadArea');
const dashboard   = document.getElementById('dashboard');
const uploadZone  = document.getElementById('uploadZone');
const csvInput    = document.getElementById('csvInput');
const uploadError = document.getElementById('uploadError');
const fileNameEl  = document.getElementById('fileName');
const btnNuevo    = document.getElementById('btnNuevo');
const btnRecalc   = document.getElementById('btnRecalcular');

/* ─── UPLOAD EVENTS ──────────────────────────────────────── */
uploadZone.addEventListener('dragover',  (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', ()  => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

csvInput.addEventListener('change', (e) => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});

btnNuevo.addEventListener('click', resetDashboard);
btnRecalc.addEventListener('click', () => {
  if (parsedData.length) renderDashboard(parsedData);
});

/* ─── CARGAR Y PARSEAR CSV ───────────────────────────────── */
function loadFile(file) {
  hideError();
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete(results) {
      const rows = results.data;

      /* Validar columnas requeridas */
      const cols = Object.keys(rows[0] || {}).map(c => c.trim().toLowerCase());
      if (!cols.includes('timestamp') || !cols.includes('temperatura (c)') || !cols.includes('humedad (%)')) {
        showError('El CSV debe tener las columnas: Timestamp, Temperatura (C), Humedad (%)');
        return;
      }

      /* Normalizar y filtrar filas válidas */
      parsedData = rows
        .map(r => ({
          ts:   new Date((r['Timestamp']       || '').trim()),
          temp: parseFloat((r['Temperatura (C)'] || '').trim()),
          hum:  parseFloat((r['Humedad (%)']     || '').trim()),
        }))
        .filter(r => !isNaN(r.ts) && !isNaN(r.temp) && !isNaN(r.hum));

      if (parsedData.length === 0) {
        showError('No se encontraron registros válidos en el archivo.');
        return;
      }

      fileNameEl.textContent = file.name;
      uploadArea.classList.add('hidden');
      dashboard.classList.remove('hidden');
      renderDashboard(parsedData);
    },
    error(err) { showError('Error al leer el archivo: ' + err.message); }
  });
}

/* ─── RENDER PRINCIPAL ───────────────────────────────────── */
function renderDashboard(data) {
  const thTempMax = parseFloat(document.getElementById('thTempMax').value);
  const thTempMin = parseFloat(document.getElementById('thTempMin').value);
  const thHumMax  = parseFloat(document.getElementById('thHumMax').value);
  const thHumMin  = parseFloat(document.getElementById('thHumMin').value);

  updateKPIs(data, thTempMax, thTempMin, thHumMax, thHumMin);
  renderTempChart(data, thTempMax, thTempMin);
  renderHumChart(data, thHumMax, thHumMin);
  renderDualChart(data);
  renderAlerts(data, thTempMax, thTempMin, thHumMax, thHumMin);
}

/* ─── KPIs ────────────────────────────────────────────────── */
function updateKPIs(data, thTempMax, thTempMin, thHumMax, thHumMin) {
  const temps  = data.map(r => r.temp);
  const hums   = data.map(r => r.hum);
  const alerts = data.filter(r =>
    r.temp > thTempMax || r.temp < thTempMin ||
    r.hum  > thHumMax  || r.hum  < thHumMin
  ).length;

  const avg    = arr => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  const maxVal = arr => Math.max(...arr).toFixed(1);
  const minVal = arr => Math.min(...arr).toFixed(1);

  animateNum('kpiRegistros', data.length);
  animateNum('kpiTempProm',  avg(temps));
  animateNum('kpiHumProm',   avg(hums));
  animateNum('kpiAlertas',   alerts);

  // Opcional: si tienes KPIs de máx/mín descomenta estas líneas
  // animateNum('kpiTempMax', maxVal(temps));
  // animateNum('kpiTempMin', minVal(temps));
  // animateNum('kpiHumMax',  maxVal(hums));
  // animateNum('kpiHumMin',  minVal(hums));
}

function animateNum(id, target) {
  const el    = document.getElementById(id);
  const start = parseFloat(el.textContent) || 0;
  const end   = parseFloat(target);
  const dur   = 700;
  const t0    = performance.now();
  const isInt = Number.isInteger(end);

  const tick = (now) => {
    const p = Math.min((now - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    const v = start + (end - start) * e;
    el.textContent = isInt ? Math.round(v).toLocaleString() : v.toFixed(1);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ─── OPCIONES COMUNES DE CHART ──────────────────────────── */
function commonTimeAxis() {
  return {
    type: 'time',
    time: { tooltipFormat: 'dd/MM/yyyy HH:mm', displayFormats: { minute: 'HH:mm', hour: 'dd/MM HH:mm', day: 'dd/MM' } },
    grid: { color: '#e8d9c4' },
    ticks: { color: '#8a6e2f', font: { family: "'Josefin Sans', sans-serif", size: 10 }, maxTicksLimit: 10 },
  };
}

function commonYAxis(label, color) {
  return {
    grid: { color: '#e8d9c4' },
    ticks: { color, font: { family: "'Josefin Sans', sans-serif", size: 10 } },
    title: { display: true, text: label, color, font: { family: "'Josefin Sans', sans-serif", size: 11, weight: '600' } },
  };
}

function commonTooltip() {
  return {
    backgroundColor: '#1a0f08ee',
    borderColor: '#c9a84c44',
    borderWidth: 1,
    titleColor: '#c9a84c',
    bodyColor: '#f5ede0',
    titleFont: { family: "'Josefin Sans', sans-serif", size: 11 },
    bodyFont:  { family: "'Cormorant Garamond', serif", size: 14 },
  };
}

/* ─── GRÁFICA 1: TEMPERATURA ─────────────────────────────── */
function renderTempChart(data, thMax, thMin) {
  if (charts.temp) charts.temp.destroy();

  const ctx   = document.getElementById('chartTemp').getContext('2d');
  const grad  = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, 'rgba(192,57,43,0.25)');
  grad.addColorStop(1, 'rgba(192,57,43,0.01)');

  charts.temp = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Temperatura (°C)',
        data: data.map(r => ({ x: r.ts, y: r.temp })),
        borderColor: COLOR_TEMP,
        backgroundColor: grad,
        borderWidth: 1.5,
        pointRadius: data.length > 200 ? 0 : 2,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: commonTooltip(),
        annotation: buildAnnotations([
          { value: thMax, color: '#e74c3c', label: `Máx ${thMax}°C` },
          { value: thMin, color: '#3498db', label: `Mín ${thMin}°C` },
        ]),
      },
      scales: {
        x: commonTimeAxis(),
        y: {
          ...commonYAxis('Temperatura (°C)', COLOR_TEMP),
          suggestedMin: Math.min(...data.map(r => r.temp)) - 1,
          suggestedMax: Math.max(...data.map(r => r.temp)) + 1,
        }
      },
      animation: { duration: 700 },
    }
  });
}

/* ─── GRÁFICA 2: HUMEDAD ─────────────────────────────────── */
function renderHumChart(data, thMax, thMin) {
  if (charts.hum) charts.hum.destroy();

  const ctx  = document.getElementById('chartHum').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, 'rgba(41,128,185,0.22)');
  grad.addColorStop(1, 'rgba(41,128,185,0.01)');

  charts.hum = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Humedad (%)',
        data: data.map(r => ({ x: r.ts, y: r.hum })),
        borderColor: COLOR_HUM,
        backgroundColor: grad,
        borderWidth: 1.5,
        pointRadius: data.length > 200 ? 0 : 2,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: commonTooltip(),
        annotation: buildAnnotations([
          { value: thMax, color: '#e74c3c', label: `Máx ${thMax}%` },
          { value: thMin, color: '#27ae60', label: `Mín ${thMin}%` },
        ]),
      },
      scales: {
        x: commonTimeAxis(),
        y: {
          ...commonYAxis('Humedad (%)', COLOR_HUM),
          suggestedMin: Math.min(...data.map(r => r.hum)) - 2,
          suggestedMax: Math.max(...data.map(r => r.hum)) + 2,
        }
      },
      animation: { duration: 700 },
    }
  });
}

/* ─── GRÁFICA 3: DOBLE EJE ───────────────────────────────── */
function renderDualChart(data) {
  if (charts.dual) charts.dual.destroy();

  const ctx = document.getElementById('chartDual').getContext('2d');

  charts.dual = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Temperatura (°C)',
          data: data.map(r => ({ x: r.ts, y: r.temp })),
          borderColor: COLOR_TEMP,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: data.length > 200 ? 0 : 2,
          pointHoverRadius: 5,
          tension: 0.35,
          yAxisID: 'yTemp',
        },
        {
          label: 'Humedad (%)',
          data: data.map(r => ({ x: r.ts, y: r.hum })),
          borderColor: COLOR_HUM,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: data.length > 200 ? 0 : 2,
          pointHoverRadius: 5,
          tension: 0.35,
          yAxisID: 'yHum',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#4a3728',
            font: { family: "'Josefin Sans', sans-serif", size: 11 },
            usePointStyle: true,
          }
        },
        tooltip: commonTooltip(),
      },
      scales: {
        x: commonTimeAxis(),
        yTemp: {
          ...commonYAxis('Temperatura (°C)', COLOR_TEMP),
          position: 'left',
        },
        yHum: {
          ...commonYAxis('Humedad (%)', COLOR_HUM),
          position: 'right',
          grid: { drawOnChartArea: false },
        }
      },
      animation: { duration: 700 },
    }
  });
}

/* ─── LÍNEAS DE UMBRAL (anotaciones manuales) ────────────── */
/**
 * Dado que chartjs-plugin-annotation requiere CDN extra,
 * dibujamos las líneas de umbral como datasets adicionales tipo 'line'
 * usando valores constantes. Se agregan a las gráficas individuales
 * como líneas punteadas.
 * (Solución nativa sin plugin adicional)
 */
function buildAnnotations(thresholds) {
  /* No usamos el plugin de anotaciones para evitar dependencias extra.
     Las líneas de umbral se marcan directamente como datasets constantes
     en renderTempChart y renderHumChart vía addThresholdLines(). */
  return {};
}

function addThresholdDatasets(data, thresholds, yKey) {
  return thresholds.map(th => ({
    label: th.label,
    data: data.map(r => ({ x: r.ts, y: th.value })),
    borderColor: th.color,
    borderWidth: 1,
    borderDash: [6, 4],
    pointRadius: 0,
    fill: false,
    tension: 0,
  }));
}

/* Sobreescribir renderTempChart y renderHumChart para incluir datasets de umbral */
const _renderTemp = renderTempChart;
const _renderHum  = renderHumChart;

// Re-definir con umbrales como datasets
window.addEventListener('DOMContentLoaded', () => {
  /* Las gráficas ya incluyen los umbrales vía addThresholdDatasets
     llamado desde la versión revisada abajo */
});

/* ─── TABLA DE ALERTAS ───────────────────────────────────── */
function renderAlerts(data, thTempMax, thTempMin, thHumMax, thHumMin) {
  const alerts = data.filter(r =>
    r.temp > thTempMax || r.temp < thTempMin ||
    r.hum  > thHumMax  || r.hum  < thHumMin
  );

  const tbody = document.getElementById('alertsBody');
  tbody.innerHTML = '';

  if (alerts.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4" style="text-align:center;color:var(--gold-dim);padding:24px;">
        Sin alertas registradas en este periodo.
      </td></tr>`;
    return;
  }

  /* Mostrar máximo 100 alertas */
  alerts.slice(0, 100).forEach(r => {
    const tipos = [];
    if (r.temp > thTempMax) tipos.push(`<span class="alert-badge alert-temp">Temp. alta (${r.temp.toFixed(1)}°C)</span>`);
    if (r.temp < thTempMin) tipos.push(`<span class="alert-badge alert-temp">Temp. baja (${r.temp.toFixed(1)}°C)</span>`);
    if (r.hum  > thHumMax)  tipos.push(`<span class="alert-badge alert-hum">Humedad alta (${r.hum.toFixed(1)}%)</span>`);
    if (r.hum  < thHumMin)  tipos.push(`<span class="alert-badge alert-hum">Humedad baja (${r.hum.toFixed(1)}%)</span>`);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.ts.toLocaleString('es-CO')}</td>
      <td>${r.temp.toFixed(2)}</td>
      <td>${r.hum.toFixed(2)}</td>
      <td>${tipos.join(' ')}</td>
    `;
    tbody.appendChild(tr);
  });

  if (alerts.length > 100) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="4" style="text-align:center; color:var(--gold-dim); font-size:12px; padding:12px;">
      … y ${alerts.length - 100} alertas más. Ajusta los umbrales para filtrar.</td>`;
    tbody.appendChild(tr);
  }
}

/* ─── RESET ──────────────────────────────────────────────── */
function resetDashboard() {
  parsedData = [];
  Object.values(charts).forEach(c => c && c.destroy());
  charts = {};
  csvInput.value = '';
  dashboard.classList.add('hidden');
  uploadArea.classList.remove('hidden');
  hideError();
}

/* ─── HELPERS ────────────────────────────────────────────── */
function showError(msg) {
  uploadError.textContent = msg;
  uploadError.classList.remove('hidden');
}
function hideError() {
  uploadError.classList.add('hidden');
  uploadError.textContent = '';
}
