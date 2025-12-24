const KEY = "kodukalVaangalLedger";
let ledger = JSON.parse(localStorage.getItem(KEY)) || [];
let chart;

/* ---------- THEME ---------- */
/* ---------- THEME (FIXED) ---------- */
const THEME_KEY = "kv_theme";

/* Apply theme on load */
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

/* Toggle theme */
function toggleTheme() {
  const html = document.documentElement;
  const btn = document.querySelector(".theme-toggle");

  if (html.classList.contains("dark")) {
    html.classList.remove("dark");
    localStorage.setItem(THEME_KEY, "light");
    btn.textContent = "🌙";
  } else {
    html.classList.add("dark");
    localStorage.setItem(THEME_KEY, "dark");
    btn.textContent = "☀️";
  }
}


/* ---------- ADD ENTRY ---------- */
function addEntry() {
  const name = nameInput.value.trim();
  const amount = Number(amountInput.value);
  const type = processInput.value;

  if (!name || amount <= 0) {
    alert("Please enter valid data");
    return;
  }

  ledger.push({
    name,
    amount,
    type,
    date: new Date().toLocaleString()
  });

  nameInput.value = "";
  amountInput.value = "";
  save();
}

/* ---------- BALANCE ---------- */
function calculateBalance(name, index) {
  let bal = 0;
  for (let i = 0; i <= index; i++) {
    if (ledger[i].name === name) {
      bal += ledger[i].type === "Borrowed"
        ? ledger[i].amount
        : -ledger[i].amount;
    }
  }
  return bal;
}

/* ---------- RENDER ---------- */
function renderTable() {
  tableBody.innerHTML = "";

  ledger.forEach((e, i) => {
    const cls = e.type === "Borrowed" ? "borrow" : "return";

    tableBody.innerHTML += `
      <tr>
        <td>${e.name}</td>
        <td>${e.date}</td>
        <td class="${cls}">${e.type}</td>
        <td>${e.amount}</td>
        <td>${calculateBalance(e.name, i)}</td>
        <td>
          <button onclick="editEntry(${i})">✏️</button>
          <button onclick="deleteEntry(${i})">🗑️</button>
        </td>
      </tr>
    `;
  });
}

/* ---------- EDIT ---------- */
function editEntry(i) {
  const e = ledger[i];

  const name = prompt("Edit name", e.name);
  const amount = Number(prompt("Edit amount", e.amount));
  const type = prompt("Type Borrowed / Returned", e.type);

  if (!name || amount <= 0 || (type !== "Borrowed" && type !== "Returned")) {
    alert("Invalid edit");
    return;
  }

  ledger[i] = {
    ...e,
    name,
    amount,
    type
  };

  save();
}

/* ---------- DELETE ---------- */
function deleteEntry(i) {
  if (confirm("Delete this entry?")) {
    ledger.splice(i, 1);
    save();
  }
}

/* ---------- SAVE ---------- */
function save() {
  localStorage.setItem(KEY, JSON.stringify(ledger));
  renderTable();
  drawChart();
}

/* ---------- EXCEL EXPORT ---------- */
function exportExcel() {
  const data = [["Name","Date","Type","Amount"]];
  ledger.forEach(e => data.push([e.name, e.date, e.type, e.amount]));

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ledger");
  XLSX.writeFile(wb, "kodukal_vaangal.xlsx");
}

/* ---------- EXCEL IMPORT ---------- */
function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    rows.forEach(r => ledger.push(r));
    save();
  };
  reader.readAsArrayBuffer(file);
}

/* ---------- CHART ---------- */
function drawChart() {
  const totals = {};
  ledger.forEach(e => {
    totals[e.name] = (totals[e.name] || 0) +
      (e.type === "Borrowed" ? e.amount : -e.amount);
  });

  if (chart) chart.destroy();
  chart = new Chart(balanceChart, {
    type: "bar",
    data: {
      labels: Object.keys(totals),
      datasets: [{
        label: "Balance",
        data: Object.values(totals)
      }]
    }
  });
}

/* ---------- INIT ---------- */
renderTable();
drawChart();


/* ---------- MONTHLY SUMMARY + RANGE FILTER + CHART ---------- */
let summaryChart;

function loadMonthlySummary() {
  const month = document.getElementById("monthPicker").value;
  const fromDate = document.getElementById("fromDate").value;
  const toDate = document.getElementById("toDate").value;

  const summary = {};

  ledger.forEach(e => {
    const d = new Date(e.date);

    // Month filter
    if (month) {
      const m = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
      if (m !== month) return;
    }

    // Date range filter
    if (fromDate && d < new Date(fromDate)) return;
    if (toDate && d > new Date(toDate + "T23:59:59")) return;

    if (!summary[e.name]) {
      summary[e.name] = { borrowed: 0, returned: 0 };
    }

    if (e.type === "Borrowed") {
      summary[e.name].borrowed += e.amount;
    } else {
      summary[e.name].returned += e.amount;
    }
  });

  const body = document.getElementById("summaryBody");
  body.innerHTML = "";

  if (Object.keys(summary).length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:gray;">
          No data for selected filters
        </td>
      </tr>`;
    drawSummaryChart({});
    return;
  }

  const chartData = {};

  Object.keys(summary).forEach(name => {
    const b = summary[name].borrowed;
    const r = summary[name].returned;
    const bal = b - r;

    chartData[name] = bal;

    body.innerHTML += `
      <tr>
        <td>${name}</td>
        <td class="borrow">₹${b}</td>
        <td class="return">₹${r}</td>
        <td><strong>₹${bal}</strong></td>
      </tr>
    `;
  });

  drawSummaryChart(chartData);
}

/* ---------- SUMMARY CHART ---------- */
function drawSummaryChart(data) {
  const ctx = document.getElementById("summaryChart");
  if (!ctx) return;

  if (summaryChart) summaryChart.destroy();

  summaryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: "Balance",
        data: Object.values(data),
        backgroundColor: "#6366f1"
      }]
    }
  });
}

/* ---------- EXPORT SUMMARY EXCEL ---------- */
function exportSummaryExcel() {
  const rows = [["Name","Borrowed","Returned","Balance"]];
  const body = document.getElementById("summaryBody").querySelectorAll("tr");

  body.forEach(tr => {
    const tds = tr.querySelectorAll("td");
    if (tds.length === 4) {
      rows.push([
        tds[0].innerText,
        tds[1].innerText,
        tds[2].innerText,
        tds[3].innerText
      ]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Summary");
  XLSX.writeFile(wb, "kodukal_vaangal_summary.xlsx");
}

/* ---------- EXPORT SUMMARY PDF ---------- */
function exportSummaryPDF() {
  const win = window.open("", "_blank");
  win.document.write("<h2>Kodukal–Vaangal Monthly Summary</h2>");
  win.document.write(document.querySelector(".ledger").innerHTML);
  win.document.close();
  win.print();
}
