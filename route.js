const ACTIVE_USER_KEY = "activeUser";
const SAVED_USER_KEY = "savedUser";
const REPORT_ENDPOINT = "https://formspree.io/f/xnjbdwyl";
const ROUTE_DATA_PREFIX = "route_data_rute_";
const REPORTS_STORAGE_KEY = "route_reports_local";
const REPORT_IMAGE_MAX_SIZE_MB = 10;
const REPORT_IMAGE_MAX_SIZE_BYTES = REPORT_IMAGE_MAX_SIZE_MB * 1024 * 1024;
const REPORT_IMAGE_MAX_DIMENSION = 1600;
const REPORT_IMAGE_TARGET_BYTES = 900 * 1024;
const REPORT_IMAGE_MIN_QUALITY = 0.55;

const params = new URLSearchParams(window.location.search);
const routeNumber = Number(params.get("rute"));
const activeUser = sessionStorage.getItem(ACTIVE_USER_KEY);

const routeTitle = document.getElementById("routeTitle");
const addressList = document.getElementById("addressList");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const popup = document.getElementById("popup");
const menuView = document.getElementById("menuView");
const reportView = document.getElementById("reportView");
const problemTypeInput = document.getElementById("problemType");
const commentInput = document.getElementById("comment");
const reportImageInput = document.getElementById("reportImage");

const storageKey = "status_rute_" + routeNumber;
const supabaseClient = window.supabaseClient;
let addresses = [];
let selectedAddressIndex = null;

routeTitle.textContent = "Rute " + routeNumber;

initializePage();

async function initializePage() {
  const allowed = await hasRouteAccess();
  if (!allowed) {
    alert("Ugyldig adgang - log ind igen.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("closePopup").addEventListener("click", closePopup);
  document.getElementById("mapsBtn").addEventListener("click", openMaps);
  document.getElementById("reportBtn").addEventListener("click", showReportForm);
  document.getElementById("backBtn").addEventListener("click", showMenu);
  document.getElementById("sendReport").addEventListener("click", sendReport);

  loadRoute();
}

async function hasRouteAccess() {
  return Boolean(routeNumber && activeUser && activeUser === String(routeNumber));
}

async function loadRoute() {
  try {
    const data = await getRouteData(routeNumber);
    if (!Array.isArray(data)) {
      throw new Error("Ruteformat er ugyldigt");
    }

    const status = await getRouteStatus(routeNumber);

    addresses = data.map((item, index) => ({
      address: String(item.address || ""),
      city: String(item.city || ""),
      delivered: Boolean(status[index]?.delivered),
      problem: Boolean(status[index]?.problem)
    }));

    renderList();
  } catch (error) {
    console.error(error);
    alert("Kunne ikke indlaese rute " + routeNumber + ".");
  }
}

async function getRouteData(routeNo) {
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
    throw new Error("Rutefil kunne ikke indlaeses");
  }

  return response.json();
}

async function getRouteStatus(routeNo) {
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

  return JSON.parse(localStorage.getItem(storageKey) || "{}");
}

function renderList() {
  addressList.innerHTML = "";

  addresses.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "address-item";

    const text = document.createElement("button");
    text.type = "button";
    text.className = "address-text";
    text.textContent = item.address + " - " + item.city;

    if (item.problem) {
      li.classList.add("is-problem");
      text.classList.add("problem");
      text.textContent += " !";
    } else if (item.delivered) {
      li.classList.add("is-delivered");
      text.classList.add("delivered");
    }

    text.addEventListener("click", () => {
      selectedAddressIndex = index;
      openPopup();
    });

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checkbox";
    checkbox.checked = item.delivered;
    checkbox.disabled = item.problem;
    checkbox.setAttribute("aria-label", "Marker adresse som afleveret");

    checkbox.addEventListener("change", async () => {
      if (addresses[index].problem) {
        checkbox.checked = false;
        return;
      }

      addresses[index].delivered = checkbox.checked;
      try {
        await saveStatus();
        renderList();
      } catch (error) {
        console.error(error);
        alert("Kunne ikke gemme status.");
        addresses[index].delivered = !checkbox.checked;
        renderList();
      }
    });

    li.appendChild(text);
    li.appendChild(checkbox);
    addressList.appendChild(li);
  });

  renderProgress();
}

function renderProgress() {
  const total = addresses.length;
  const delivered = addresses.filter((item) => item.delivered).length;
  const problem = addresses.filter((item) => item.problem).length;
  const completed = delivered + problem;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  progressText.textContent =
    "Afkrydset: " + delivered + " / " + total + " (Problemer: " + problem + ")";
  progressFill.style.width = percent + "%";
}

async function saveStatus() {
  const status = {};

  addresses.forEach((item, index) => {
    status[index] = {
      delivered: item.delivered,
      problem: item.problem
    };
  });

  if (supabaseClient) {
    const payload = addresses.map((item, index) => ({
      route_no: routeNumber,
      address_index: index,
      delivered: item.delivered,
      problem: item.problem
    }));

    const { error } = await supabaseClient
      .from("route_status")
      .upsert(payload, { onConflict: "route_no,address_index" });

    if (!error) {
      localStorage.setItem(storageKey, JSON.stringify(status));
      return;
    }
    console.warn("Cloud status upsert failed, using local fallback:", error.message);
  }

  localStorage.setItem(storageKey, JSON.stringify(status));
}

function openPopup() {
  showMenu();
  popup.classList.remove("hidden");
  popup.setAttribute("aria-hidden", "false");
}

function closePopup() {
  popup.classList.add("hidden");
  popup.setAttribute("aria-hidden", "true");
  commentInput.value = "";
  problemTypeInput.selectedIndex = 0;
  reportImageInput.value = "";
}

function showMenu() {
  reportView.classList.add("hidden");
  menuView.classList.remove("hidden");
}

function showReportForm() {
  menuView.classList.add("hidden");
  reportView.classList.remove("hidden");
}

function openMaps() {
  if (selectedAddressIndex === null) {
    return;
  }

  const item = addresses[selectedAddressIndex];
  const query = encodeURIComponent(item.address + " " + item.city);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = isIOS
    ? "https://maps.apple.com/?q=" + query
    : "https://www.google.com/maps/search/?api=1&query=" + query;

  window.open(url, "_blank");
}

async function sendReport() {
  if (selectedAddressIndex === null) {
    return;
  }

  const item = addresses[selectedAddressIndex];
  const problemType = problemTypeInput.value;
  const comment = commentInput.value.trim();
  let imageData = "";
  let reportSaveResult = null;

  try {
    imageData = await readReportImageData();
  } catch (error) {
    alert(error.message || "Kunne ikke haandtere billedet.");
    return;
  }

  item.problem = true;
  item.delivered = false;

  try {
    await saveStatus();
    reportSaveResult = await saveReportEntrySafe({
      route_no: routeNumber,
      address_index: selectedAddressIndex,
      address: item.address,
      city: item.city,
      problem_type: problemType,
      comment: comment || "",
      image_data: imageData || "",
      reported_at: new Date().toISOString()
    });
    renderList();
    closePopup();
  } catch (error) {
    console.error(error);
    alert("Kunne ikke gemme problemstatus.");
    return;
  }

  if (reportSaveResult && !reportSaveResult.savedToCloud) {
    const errorText = reportSaveResult.cloudError
      ? " Cloud-fejl: " + reportSaveResult.cloudError
      : "";
    alert("Rapport gemt lokalt pa denne enhed. Den vises ikke i admin foer cloud virker." + errorText);
  } else if (reportSaveResult && reportSaveResult.imageRemoved) {
    alert("Rapport gemt i cloud, men billedet var for stort og blev ikke gemt.");
  }

  try {
    const response = await fetch(REPORT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subject: "Problem pa rute " + routeNumber,
        message:
          "Rapport fra Ravnetroppen\n\n" +
          "Rute: " + routeNumber + "\n" +
          "Adresse: " + item.address + "\n" +
          "By: " + item.city + "\n" +
          "Problemtype: " + problemType + "\n" +
          "Kommentar: " + (comment || "Ingen")
      })
    });

    if (!response.ok) {
      alert("Rapport kunne ikke sendes.");
      return;
    }

    alert("Rapport sendt.");
  } catch (error) {
    console.error(error);
    alert("Netvaerksfejl - rapport ikke sendt.");
  }
}

async function readReportImageData() {
  const file = reportImageInput.files && reportImageInput.files[0];
  if (!file) {
    return "";
  }

  if (file.size > REPORT_IMAGE_MAX_SIZE_BYTES) {
    throw new Error("Billedet er for stort. Vaelg maks " + REPORT_IMAGE_MAX_SIZE_MB + " MB.");
  }

  if (!file.type.startsWith("image/")) {
    return readFileAsDataURL(file);
  }

  // Bevar filtyper hvor canvas-rasterisering kan oedelaegge indhold (fx GIF animation/SVG).
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return readFileAsDataURL(file);
  }

  try {
    return await compressImageForReport(file);
  } catch (error) {
    console.warn("Image compression failed, using original image data:", error);
    return readFileAsDataURL(file);
  }
}

async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Kunne ikke laese billedet."));
    reader.readAsDataURL(file);
  });
}

async function compressImageForReport(file) {
  const image = await loadImageFromFile(file);
  const size = fitDimensions(image.naturalWidth || image.width, image.naturalHeight || image.height, REPORT_IMAGE_MAX_DIMENSION);
  let width = size.width;
  let height = size.height;
  let quality = 0.9;
  let blob = null;

  while (true) {
    blob = await renderToJpegBlob(image, width, height, quality);
    if (!blob) {
      throw new Error("Kunne ikke komprimere billedet.");
    }
    if (blob.size <= REPORT_IMAGE_TARGET_BYTES) {
      break;
    }

    if (quality > REPORT_IMAGE_MIN_QUALITY) {
      quality = Math.max(REPORT_IMAGE_MIN_QUALITY, quality - 0.1);
      continue;
    }

    if (Math.max(width, height) <= 900) {
      break;
    }

    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
  }

  return blobToDataURL(blob);
}

async function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Kunne ikke indlaese billedet."));
    };
    img.src = objectUrl;
  });
}

function fitDimensions(width, height, maxDimension) {
  if (!width || !height || Math.max(width, height) <= maxDimension) {
    return { width, height };
  }

  if (width >= height) {
    return {
      width: maxDimension,
      height: Math.round((height / width) * maxDimension)
    };
  }

  return {
    width: Math.round((width / height) * maxDimension),
    height: maxDimension
  };
}

async function renderToJpegBlob(image, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

async function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Kunne ikke laese komprimeret billede."));
    reader.readAsDataURL(blob);
  });
}

async function saveReportEntrySafe(report) {
  let cloudErrorMessage = "";

  if (supabaseClient) {
    const variants = [
      {
        route_no: report.route_no,
        address_index: report.address_index,
        address: report.address,
        city: report.city,
        problem_type: report.problem_type,
        comment: report.comment,
        image_data: report.image_data,
        reported_at: report.reported_at
      },
      {
        route_no: report.route_no,
        address_index: report.address_index,
        address: report.address,
        city: report.city,
        problem_type: report.problem_type,
        comment: report.comment,
        image_data: "",
        reported_at: report.reported_at
      },
      {
        route_no: report.route_no,
        address_index: report.address_index,
        address: report.address,
        city: report.city,
        problem_type: report.problem_type,
        comment: report.comment
      },
      {
        route_no: report.route_no,
        address: report.address,
        city: report.city,
        problem_type: report.problem_type,
        comment: report.comment,
        image_data: "",
        reported_at: report.reported_at
      },
      {
        route_no: report.route_no,
        address: report.address,
        city: report.city,
        problem_type: report.problem_type,
        comment: report.comment
      }
    ];

    for (const variant of variants) {
      const { error } = await supabaseClient.from("route_reports").insert(variant);
      if (!error) {
        return {
          savedToCloud: true,
          imageRemoved: !variant.image_data && Boolean(report.image_data)
        };
      }
      cloudErrorMessage = error.message || cloudErrorMessage;
    }

    // Fallback hvis cloud-rapportering fejler (fx manglende tabel/policy).
    console.warn("Cloud report insert failed, using local fallback:", cloudErrorMessage);
  }

  const reports = JSON.parse(localStorage.getItem(REPORTS_STORAGE_KEY) || "[]");
  try {
    reports.push(report);
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
  } catch (error) {
    // Store uden billede hvis browserens storage-kvote rammes.
    if (error && error.name === "QuotaExceededError" && report.image_data) {
      reports[reports.length - 1] = {
        ...report,
        image_data: ""
      };
      localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
      return {
        savedToCloud: false,
        imageRemoved: true,
        cloudError: cloudErrorMessage
      };
    }
    throw error;
  }

  return {
    savedToCloud: false,
    imageRemoved: false,
    cloudError: cloudErrorMessage || (supabaseClient ? "Ukendt cloud-fejl" : "Supabase er ikke initialiseret")
  };
}

async function logout() {
  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }
  localStorage.removeItem(SAVED_USER_KEY);
  sessionStorage.removeItem(ACTIVE_USER_KEY);
  window.location.href = "index.html";
}
