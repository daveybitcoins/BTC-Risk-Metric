/* Shared accessible reading controls for the canvas risk charts. */
function installChartReader(canvas, points, pointFromEvent, metric) {
  if (!canvas || !points.length || canvas.dataset.readerReady) return;
  canvas.dataset.readerReady = 'true';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', (metric === 'vix' ? 'VIX history' : 'Price and risk history') + '. Use left and right arrows to inspect dates.');
  const controls = document.createElement('div');
  controls.className = 'chart-access';
  const label = document.createElement('label');
  label.textContent = 'Inspect date';
  const input = document.createElement('input');
  input.type = 'date';
  input.min = points[0].date;
  input.max = points[points.length - 1].date;
  label.appendChild(input);
  const output = document.createElement('output');
  output.id = canvas.id + '-reading';
  output.setAttribute('aria-live', 'polite');
  canvas.setAttribute('aria-describedby', output.id);
  const download = document.createElement('a');
  download.href = '#';
  download.textContent = 'Download chart data';
  download.addEventListener('click', function(event) {
    event.preventDefault();
    const csv = 'date,price,risk,vix\n' + points.map(p => [p.date, p.price, p.riskCombo, p.vix == null ? '' : p.vix].join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = (document.querySelector('[data-risk-dashboard]')?.dataset.riskDashboard || 'market') + '-' + canvas.id + '.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  controls.append(label, output, download);
  canvas.before(controls);
  let index = points.length - 1;
  function show(next) {
    index = Math.max(0, Math.min(points.length - 1, next));
    const p = points[index];
    input.value = p.date;
    output.textContent = p.date + ' · ' + (metric === 'vix'
      ? 'VIX ' + (Number.isFinite(p.vix) ? p.vix.toFixed(2) : 'unavailable')
      : '$' + p.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' · Risk ' + p.riskCombo.toFixed(3));
  }
  input.addEventListener('change', function() {
    if (!input.value || !input.validity.valid) return;
    let lo = 0, hi = points.length - 1;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (points[mid].date < input.value) lo = mid + 1; else hi = mid; }
    show(lo);
  });
  canvas.addEventListener('keydown', function(event) {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, PageUp: -30, PageDown: 30 };
    if (Object.hasOwn(offsets, event.key)) { event.preventDefault(); show(index + offsets[event.key]); }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); show(event.key === 'Home' ? 0 : points.length - 1); }
  });
  let down = null;
  canvas.addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY }; });
  canvas.addEventListener('pointerup', function(event) {
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 10) {
      show(pointFromEvent(event));
      if (event.pointerType !== 'mouse') canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: event.clientX, clientY: event.clientY }));
    }
    down = null;
  });
  canvas.addEventListener('pointercancel', () => { down = null; });
  show(index);
}
