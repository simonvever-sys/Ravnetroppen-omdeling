const ACTIVE_USER_KEY = "activeUser";
const SAVED_USER_KEY = "savedUser";
const ROUTE_DATA_PREFIX = "route_data_rute_";
const ROUTE_STATUS_PREFIX = "status_rute_";
const REPORTS_STORAGE_KEY = "route_reports_local";
const MAX_ROUTES = 20;

const routeSelect = document.getElementById("routeSelect");
const uploadRouteSelect = document.getElementById("uploadRouteSelect");
const logoutBtn = document.getElementById("logoutBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const resetRouteBtn = document.getElementById("resetRouteBtn");
const refreshStatsBtn = document.getElementById("refreshStatsBtn");
const statsBody = document.getElementById("statsBody");
const routeUploadInput = document.getElementById("routeUpload");
const uploadRoutesBtn = document.getElementById("uploadRoutesBtn");
const clearUploadedBtn = document.getElementById("clearUploadedBtn");
const uploadMsg = document.getElementById("uploadMsg");
const refreshReportsBtn = document.getElementById("refreshReportsBtn");
const reportsList = document.getElementById("reportsList");
const supabaseClient = window.supabaseClient;

initializePage();

async function initializePage() {
  const allowed = await hasAdminAccess();
  if (!allowed) {
    alert("Ugyldig adgang - log ind som admin.");
    window.location.href = "index.html";
    return;
  }

  buildRouteOptions();

  logoutBtn.addEventListener("click", logout);
  resetAllBtn.addEventListener("click", resetAll);
  resetRouteBtn.addEventListener("click", resetSingleRoute);
  refreshStatsBtn.addEventListener("click", () => {
    renderStats();
  });
  uploadRoutesBtn.addEventListener("click", uploadRoutes);
  clearUploadedBtn.addEventListener("click", clearUploadedRoutes);
  refreshReportsBtn.addEventListener("click", () => {
    renderReports();
  });

  renderStats();
  renderReports();
}

async function hasAdminAccess() {
  return sessionStorage.getItem(ACTIVE_USER_KEY) === "admin";
}

function buildRouteOptions() {
  for (let i = 1; i <= MAX_ROUTES; i += 1) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = "Rute " + i;
    routeSelect.appendChild(option);

    const uploadOption = document.createElement("option");
    uploadOption.value = String(i);
    uploadOption.textContent = "Rute " + i;
    uploadRouteSelect.appendChild(uploadOption);
  }
}

async function logout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  localStorage.removeItem(SAVED_USER_KEY);
  sessionStorage.removeItem(ACTIVE_USER_KEY);
  window.location.href = "index.html";
}

async function resetAll() {
  if (!window.confirm("Er du sikker? Dette nulstiller ALLE ruter.")) {
    return;
  }

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("route_status")
        .delete()
        .gte("route_no", 1)
        .lte("route_no", MAX_ROUTES);

      if (error) {
        throw error;
      }
    } else {
      for (let i = 1; i <= MAX_ROUTES; i += 1) {
        localStorage.removeItem(ROUTE_STATUS_PREFIX + i);
      }
    }

    await renderStats();
    alert("Alle ruter er nulstillet.");
  } catch (error) {
    console.error(error);
    alert("Kunne ikke nulstille alle ruter.");
  }
}

async function resetSingleRoute() {
  const route = Number(routeSelect.value);
  if (!route) {
    return;
  }

  if (!window.confirm("Nulstil rute " + route + "?")) {
    return;
  }

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("route_status")
        .delete()
        .eq("route_no", route);

      if (error) {
        throw error;
      }
    } else {
      localStorage.removeItem(ROUTE_STATUS_PREFIX + route);
    }

    await renderStats();
    alert("Rute " + route + " er nulstillet.");
  } catch (error) {
    console.error(error);
    alert("Kunne ikke nulstille ruten.");
  }
}

async function renderStats() {
  statsBody.innerHTML = "";

  for (let routeNo = 1; routeNo <= MAX_ROUTES; routeNo += 1) {
    const row = document.createElement("tr");
    row.innerHTML = "<td>Rute " + routeNo + "</td><td>...</td><td>...</td><td>...</td><td>...</td>";
    statsBody.appendChild(row);

    try {
      const addresses = await loadRouteData(routeNo);
      const status = await loadRouteStatus(routeNo);

      let delivered = 0;
      let problem = 0;

      for (let i = 0; i < addresses.length; i += 1) {
        if (status[i]?.problem) {
          problem += 1;
          continue;
        }
        if (status[i]?.delivered) {
          delivered += 1;
        }
      }

      const total = addresses.length;
      const percent = total === 0 ? 0 : Math.round((delivered / total) * 100);
      row.innerHTML =
        "<td>Rute " + routeNo + "</td>" +
        "<td>" + delivered + "</td>" +
        "<td>" + problem + "</td>" +
        "<td>" + total + "</td>" +
        "<td>" + percent + "%</td>";
    } catch (_error) {
      row.innerHTML =
        "<td>Rute " + routeNo + "</td>" +
        "<td>-</td>" +
        "<td>-</td>" +
        "<td>-</td>" +
        "<td>Fejl</td>";
    }
  }
}

async function loadRouteData(routeNo) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("route_addresses")
      .select("address_index,address,city")
      .eq("route_no", routeNo)
      .order("address_index", { ascending: true });

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      return data.map((row) => ({ address: row.address, city: row.city }));
    }
  }

  const uploadedData = localStorage.getItem(ROUTE_DATA_PREFIX + routeNo);
  if (uploadedData) {
    return JSON.parse(uploadedData);
  }

  const response = await fetch("data/rute" + routeNo + ".json");
  if (!response.ok) {
    throw new Error("Mangler rutefil");
  }

  const parsed = await response.json();
  if (!Array.isArray(parsed)) {
    throw new Error("Ugyldig rutefil");
  }

  return parsed;
}

async function loadRouteStatus(routeNo) {
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("route_status")
      .select("address_index,delivered,problem")
      .eq("route_no", routeNo);

    if (error) {
      throw error;
    }

    const mapped = {};
    (data || []).forEach((row) => {
      mapped[row.address_index] = {
        delivered: row.delivered,
        problem: row.problem
      };
    });
    return mapped;
  }

  return JSON.parse(localStorage.getItem(ROUTE_STATUS_PREFIX + routeNo) || "{}");
}

async function uploadRoutes() {
  uploadMsg.textContent = "";

  if (!routeUploadInput.files || routeUploadInput.files.length === 0) {
    uploadMsg.textContent = "Vaelg mindst en fil foerst.";
    return;
  }

  const results = [];
  const selectedUploadRoute = Number(uploadRouteSelect.value) || null;

  for (const file of routeUploadInput.files) {
    try {
      const uploads = await parseUploadsFromFile(file, selectedUploadRoute);
      for (const upload of uploads) {
        await persistRouteData(upload.routeNo, upload.entries);
        results.push(
          file.name + ": Uploadet til rute " + upload.routeNo + " (" + upload.entries.length + " adresser)"
        );
      }
    } catch (error) {
      results.push(file.name + ": " + (error.message || "Ugyldig filformat/indhold"));
    }
  }

  uploadMsg.textContent = results.join(" | ");
  routeUploadInput.value = "";
  await renderStats();
}

async function parseUploadsFromFile(file, forcedRouteNo) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".json")) {
    return parseJsonUpload(file, forcedRouteNo);
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".csv")) {
    return parseSpreadsheetUpload(file, forcedRouteNo);
  }

  throw new Error("Ikke understoettet filtype");
}

async function parseJsonUpload(file, forcedRouteNo) {
  const routeNo = forcedRouteNo || getRouteFromFilename(file.name);
  if (!routeNo) {
    throw new Error("JSON skal navngives ruteX.json");
  }

  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("JSON er ikke en liste");
  }

  return [{
    routeNo,
    entries: normalizeEntries(parsed)
  }];
}

async function parseSpreadsheetUpload(file, forcedRouteNo) {
  if (typeof XLSX === "undefined") {
    throw new Error("Excel bibliotek mangler");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Arket er tomt");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) {
    throw new Error("Arket er tomt");
  }

  const normalizedRows = rows.map(normalizeRowKeys);
  if (forcedRouteNo) {
    const entries = extractEntriesFromRows(normalizedRows);

    if (!entries.length) {
      throw new Error("Ingen adresser fundet i filen");
    }

    return [{ routeNo: forcedRouteNo, entries }];
  }

  const hasRouteColumn = normalizedRows.some((row) => Number(row.route || row.rute));

  if (hasRouteColumn) {
    const grouped = {};
    normalizedRows.forEach((row) => {
      const routeNo = Number(row.route || row.rute);
      if (!routeNo || routeNo < 1 || routeNo > MAX_ROUTES) {
        return;
      }

      if (!grouped[routeNo]) {
        grouped[routeNo] = [];
      }

      grouped[routeNo].push(row);
    });

    const uploads = Object.keys(grouped).map((routeNo) => ({
      routeNo: Number(routeNo),
      entries: extractEntriesFromRows(grouped[routeNo])
    })).filter((upload) => upload.entries.length > 0);

    if (!uploads.length) {
      throw new Error("Ingen gyldige ruter fundet i arket");
    }

    return uploads;
  }

  const routeNo = getRouteFromFilename(file.name);
  if (!routeNo) {
    throw new Error("Navngiv filen ruteX.xlsx/csv eller tilfoej kolonnen rute");
  }

  const entries = extractEntriesFromRows(normalizedRows);
  if (!entries.length) {
    throw new Error("Ingen adresser fundet i filen");
  }

  return [{ routeNo, entries }];
}

function normalizeRowKeys(row) {
  const output = {};
  Object.keys(row).forEach((key) => {
    const normalizedKey = String(key)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/_/g, "");
    output[normalizedKey] = row[key];
  });
  return output;
}

function normalizeEntries(entries) {
  return entries
    .map((entry) => ({
      address: String(entry?.address || "").trim(),
      city: String(entry?.city || "").trim()
    }))
    .filter((entry) => entry.address.length > 0);
}

function extractEntriesFromRows(rows) {
  if (!rows.length) {
    return [];
  }

  const addressCandidates = ["address", "adresse", "vej", "vejnavn", "street"];
  const cityCandidates = ["city", "by", "postby", "town"];

  const sampleKeys = Object.keys(rows[0]);
  let addressKey = findFirstKey(sampleKeys, addressCandidates);
  let cityKey = findFirstKey(sampleKeys, cityCandidates);

  if (!addressKey) {
    const generic = sampleKeys.filter((key) => key !== "route" && key !== "rute");
    addressKey = generic[0] || null;
    cityKey = cityKey || generic[1] || null;
  }

  return normalizeEntries(
    rows.map((row) => ({
      address: addressKey ? row[addressKey] : "",
      city: cityKey ? row[cityKey] : ""
    }))
  );
}

function findFirstKey(keys, candidates) {
  for (const candidate of candidates) {
    const found = keys.find((key) => key === candidate);
    if (found) {
      return found;
    }
  }
  return null;
}

function getRouteFromFilename(fileName) {
  const match = fileName.toLowerCase().match(/^rute(\d+)\.(json|xlsx|xls|csv)$/);
  if (!match) {
    return null;
  }

  const routeNo = Number(match[1]);
  if (!routeNo || routeNo < 1 || routeNo > MAX_ROUTES) {
    return null;
  }

  return routeNo;
}

async function persistRouteData(routeNo, entries) {
  if (!entries || entries.length === 0) {
    throw new Error("Ingen gyldige adresser at gemme");
  }

  if (supabaseClient) {
    const { error: deleteError } = await supabaseClient
      .from("route_addresses")
      .delete()
      .eq("route_no", routeNo);

    if (deleteError) {
      throw deleteError;
    }

    const payload = entries.map((entry, index) => ({
      route_no: routeNo,
      address_index: index,
      address: entry.address,
      city: entry.city
    }));

    if (payload.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("route_addresses")
        .insert(payload);

      if (insertError) {
        throw insertError;
      }
    }

    return;
  }

  localStorage.setItem(ROUTE_DATA_PREFIX + routeNo, JSON.stringify(entries));
}

async function clearUploadedRoutes() {
  if (!window.confirm("Slet alle uploadede ruter?")) {
    return;
  }

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("route_addresses")
        .delete()
        .gte("route_no", 1)
        .lte("route_no", MAX_ROUTES);

      if (error) {
        throw error;
      }
    } else {
      for (let i = 1; i <= MAX_ROUTES; i += 1) {
        localStorage.removeItem(ROUTE_DATA_PREFIX + i);
      }
    }

    uploadMsg.textContent = "Uploadede ruter er slettet.";
    await renderStats();
  } catch (error) {
    console.error(error);
    uploadMsg.textContent = "Kunne ikke slette uploadede ruter.";
  }
}

async function renderReports() {
  reportsList.innerHTML = "";

  try {
    const reports = await loadReports();
    if (!reports.length) {
      reportsList.innerHTML = "<li class=\"report-item\">Ingen indrapporteringer endnu.</li>";
      return;
    }

    reports.forEach((report) => {
      const item = document.createElement("li");
      item.className = "report-item";

      const date = new Date(report.reported_at || Date.now());
      const timestamp = date.toLocaleString("da-DK");
      const text = document.createElement("div");
      text.className = "report-text";
      text.textContent =
        "Rute " + report.route_no +
        " | " + (report.address || "Ukendt adresse") +
        " (" + (report.city || "Ukendt by") + ")" +
        " | Problem: " + (report.problem_type || "Ukendt") +
        (report.comment ? " | Kommentar: " + report.comment : "") +
        " | Tid: " + timestamp;

      item.appendChild(text);

      if (report.image_data) {
        const viewImageBtn = document.createElement("button");
        viewImageBtn.type = "button";
        viewImageBtn.className = "secondary-btn report-image-btn";
        viewImageBtn.textContent = "Vis billede";
        viewImageBtn.addEventListener("click", () => {
          openReportImage(report.image_data);
        });
        item.appendChild(viewImageBtn);
      }

      reportsList.appendChild(item);
    });
  } catch (error) {
    console.error(error);
    reportsList.innerHTML = "<li class=\"report-item\">Kunne ikke hente indrapporteringer.</li>";
  }
}

async function loadReports() {
  const localReports = JSON.parse(localStorage.getItem(REPORTS_STORAGE_KEY) || "[]");

  if (supabaseClient) {
    const queries = [
      () => supabaseClient
        .from("route_reports")
        .select("route_no,address_index,address,city,problem_type,comment,image_data,reported_at,created_at")
        .order("reported_at", { ascending: false }),
      () => supabaseClient
        .from("route_reports")
        .select("route_no,address_index,address,city,problem_type,comment,reported_at,created_at")
        .order("reported_at", { ascending: false }),
      () => supabaseClient
        .from("route_reports")
        .select("route_no,address_index,address,city,problem_type,comment,image_data,created_at")
        .order("created_at", { ascending: false }),
      () => supabaseClient
        .from("route_reports")
        .select("route_no,address_index,address,city,problem_type,comment,created_at")
        .order("created_at", { ascending: false }),
      () => supabaseClient
        .from("route_reports")
        .select("*")
    ];

    let data = null;
    let error = null;
    for (const runQuery of queries) {
      const result = await runQuery();
      if (!result.error) {
        data = result.data;
        error = null;
        break;
      }
      error = result.error;
    }

    if (!error && data) {
      const cloudReports = (data || []).map((report) => ({
        ...report,
        image_data: report.image_data || "",
        reported_at: report.reported_at || report.created_at || new Date().toISOString()
      }));
      const merged = [...cloudReports, ...localReports];
      return sortAndDedupeReports(merged);
    }
  }

  return sortAndDedupeReports(localReports);
}

function openReportImage(imageData) {
  if (!imageData) {
    return;
  }

  const imageWindow = window.open("", "_blank");
  if (!imageWindow) {
    alert("Browseren blokerede vinduet. Tillad popups for at se billedet.");
    return;
  }

  imageWindow.document.write(
    "<!doctype html><html><head><meta charset='utf-8'><title>Rapportbillede</title></head>" +
    "<body style='margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;'>" +
    "<img src='" + imageData + "' alt='Rapportbillede' style='max-width:100%;max-height:100vh;object-fit:contain;'/>" +
    "</body></html>"
  );
  imageWindow.document.close();
}

function sortAndDedupeReports(reports) {
  const seen = new Set();
  const deduped = [];

  reports.forEach((report) => {
    const key = [
      report.route_no,
      report.address_index,
      report.problem_type,
      report.reported_at || report.created_at || ""
    ].join("|");

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(report);
    }
  });

  return deduped.sort((a, b) => {
    const bDate = new Date(b.reported_at || b.created_at || 0).getTime();
    const aDate = new Date(a.reported_at || a.created_at || 0).getTime();
    return bDate - aDate;
  });
}
