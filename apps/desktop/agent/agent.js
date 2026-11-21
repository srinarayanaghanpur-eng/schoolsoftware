const state = {
  bootstrap: null,
  settings: null,
  years: [],
  students: [],
  selected: new Set(),
  campaignId: "",
  campaign: null,
  recipients: [],
  sentToday: 0,
  erpTokenAvailable: false,
  lastQueueRender: 0,
  busy: false
};

const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function normalizePhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return "";
}

function displayPhone(phone) {
  if (/^91\d{10}$/.test(phone)) return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
  return phone || "-";
}

function parentName(student) {
  return String(
    student.parentName ||
      student.fatherName ||
      student.motherName ||
      student.guardianName ||
      "Parent"
  ).trim();
}

function studentPhone(student) {
  return normalizePhone(
    student.parentMobile ||
      student.fatherPhone ||
      student.motherPhone ||
      student.guardianPhone ||
      student.phone ||
      ""
  );
}

function classText(student) {
  const className = String(student.class || student.classId || "").trim();
  const section = String(student.section || student.sectionId || "").trim();
  if (!className) return "-";
  return section ? `${className}-${section}` : className;
}

function money(value) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? `Rs.${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "Rs.0";
}

function dueOf(student) {
  return student.totalFeesDue ?? student.totalDue ?? 0;
}

function renderTemplate(template, data) {
  return String(template ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const value = data[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function previewData(student) {
  if (!student) return null;
  return {
    parentName: parentName(student),
    studentName: String(student.studentName || ""),
    children: `${String(student.studentName || "Student")} (${classText(student) === "-" ? "Class -" : `Class ${classText(student)}`})`,
    className: String(student.class || ""),
    section: String(student.section || ""),
    dueAmount: money(dueOf(student)).replace("Rs.", ""),
    totalDue: money(dueOf(student)).replace("Rs.", ""),
    admissionNumber: String(student.admissionNumber || student.admissionNo || ""),
    schoolName: String($("schoolName").value || state.settings?.schoolName || "Sri Narayana High School"),
    studentCount: 1
  };
}

function setNotice(text, kind = "") {
  const node = $("notice");
  if (!text) {
    node.className = "notice hidden";
    node.textContent = "";
    return;
  }
  node.textContent = text;
  node.className = `notice ${kind}`.trim();
}

function setErpStatus(available) {
  state.erpTokenAvailable = available;
  const pill = $("erpPill");
  pill.textContent = available ? "ERP: connected" : "ERP: sign in needed";
  pill.className = `pill ${available ? "pill-ok" : "pill-warn"}`;
}

async function call(method, ...args) {
  if (!window.agent || typeof window.agent[method] !== "function") {
    throw new Error("Desktop bridge is unavailable. Reopen the app.");
  }
  const result = await window.agent[method](...args);
  if (!result || result.ok !== true) {
    throw new Error(result?.error || "Agent request failed");
  }
  return result.data;
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${name}`);
  });
}

function fillYears(years) {
  const select = $("yearSelect");
  select.innerHTML = "";
  if (!years.length) {
    select.innerHTML = '<option value="">No academic years</option>';
    return;
  }
  for (const year of years) {
    const option = document.createElement("option");
    option.value = year.id;
    option.textContent = `${year.name}${year.isActive ? " (active)" : ""}`;
    select.appendChild(option);
  }
  const active = years.find((year) => year.isActive);
  if (active) select.value = active.id;
}

function filteredStudents() {
  return state.students;
}

function renderStudents() {
  const body = $("studentsBody");
  const rows = filteredStudents();
  $("loadedCount").textContent = `${rows.length} student${rows.length === 1 ? "" : "s"}`;
  $("studentsMeta").textContent = rows.length
    ? `${rows.length} loaded. Select the parents to message.`
    : "Load students to begin.";

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No students loaded.</td></tr>';
    updateSelection();
    return;
  }

  body.innerHTML = rows
    .map((student) => {
      const phone = studentPhone(student);
      return `
        <tr>
          <td class="w-check"><input type="checkbox" data-student-id="${esc(student.id)}" ${
            state.selected.has(String(student.id)) ? "checked" : ""
          } /></td>
          <td><strong>${esc(student.studentName || "Student")}</strong><br /><span class="muted">${esc(
            student.admissionNumber || student.admissionNo || ""
          )}</span></td>
          <td>${esc(classText(student))}</td>
          <td>${esc(parentName(student))}</td>
          <td>${phone ? esc(displayPhone(phone)) : '<span class="status failed">No mobile</span>'}</td>
          <td class="right">${esc(money(dueOf(student)))}</td>
        </tr>`;
    })
    .join("");

  document.querySelectorAll("#studentsBody input[data-student-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const id = String(checkbox.dataset.studentId || "");
      if (checkbox.checked) state.selected.add(id);
      else state.selected.delete(id);
      updateSelection();
    });
  });
  updateSelection();
}

function updateSelection() {
  const count = state.selected.size;
  $("selectionCount").textContent = `${count} selected`;
  const first = state.students.find((student) => state.selected.has(String(student.id))) || state.students[0];
  const preview = previewData(first);
  $("messagePreview").textContent = preview
    ? renderTemplate($("templateInput").value, preview)
    : "Select students to preview.";
}

function renderCampaign(campaign) {
  state.campaign = campaign;
  if (!campaign) return;
  $("campaignPanel").classList.remove("hidden");
  $("campaignTitle").textContent = campaign.name || "Campaign";
  const status = campaign.status || "ready";
  $("campaignStatus").textContent = status;
  $("campaignStatus").className = `pill ${
    status === "completed" ? "pill-ok" : status === "paused" ? "pill-warn" : ""
  }`;

  const counts = campaign.counts || {};
  const stats = [
    ["Pending", counts.pending || 0],
    ["Sending", counts.sending || 0],
    ["Sent", counts.sent || 0],
    ["Failed", counts.failed || 0],
    ["Duplicate", counts.duplicate || 0],
    ["Skipped", counts.skipped || 0]
  ];
  $("campaignStats").innerHTML = stats
    .map(
      ([label, value]) =>
        `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`
    )
    .join("");

  $("capText").textContent = `${state.sentToday} sent today / cap ${state.settings?.dailyCap ?? 100}`;
  $("pauseReason").textContent = campaign.pauseReason || "";
  $("startBtn").disabled = state.busy || status === "running" || (counts.pending || 0) === 0;
  $("pauseBtn").disabled = state.busy || status !== "running";
  $("resumeBtn").disabled = state.busy || status === "running" || (counts.pending || 0) === 0;
  $("retryBtn").disabled = state.busy || (counts.failed || 0) === 0;
}

function renderQueue(force = false) {
  if (!force && Date.now() - state.lastQueueRender < 4000) return;
  state.lastQueueRender = Date.now();
  const body = $("queueBody");
  const filter = $("queueFilter").value;
  const rows = state.recipients.filter((row) => !filter || row.status === filter);

  if (!state.campaignId) {
    body.innerHTML = '<tr><td colspan="9" class="empty">No campaign selected.</td></tr>';
    return;
  }
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty">No recipients for this filter.</td></tr>';
    return;
  }

  body.innerHTML = rows
    .map((row) => {
      const students =
        Number(row.studentCount || 1) > 1
          ? `${row.studentName} +${Number(row.studentCount) - 1}`
          : row.studentName;
      return `
        <tr>
          <td>${esc(row.parentName)}</td>
          <td>${esc(displayPhone(row.phone))}</td>
          <td>${esc(students)}</td>
          <td>${esc(row.className || "")}${row.section ? `-${esc(row.section)}` : ""}</td>
          <td class="right">${esc(money(row.dueAmount))}</td>
          <td><span class="status ${esc(row.status)}">${esc(row.status)}</span></td>
          <td>${esc(row.attempts || 0)}</td>
          <td title="${esc(row.lastError || "")}">${esc((row.lastError || "").slice(0, 80))}</td>
          <td>${row.sentAt ? esc(new Date(row.sentAt).toLocaleString()) : "-"}</td>
        </tr>`;
    })
    .join("");
}

function applyGatewayPresetUI(autoFill = false) {
  const smsGate = $("gatewayPreset").value === "sms-gate-app";
  if (smsGate) {
    $("authMode").value = "basic";
    if (autoFill) {
      const url = $("gatewayUrl").value.trim();
      if (
        !url ||
        url === "http://192.168.1.50:8080/api/send" ||
        url === "http://192.168.1.132:8080/message"
      ) {
        $("gatewayUrl").value = "";
      }
      if (!$("authUsername").value.trim()) $("authUsername").value = "sms";
      if (!$("authHeader").value.trim()) $("authHeader").value = "Authorization";
      if (!$("authTokenPrefix").value) $("authTokenPrefix").value = "Bearer ";
    }
  }

  $("authMode").disabled = smsGate;
  document.querySelectorAll(".preset-generic").forEach((node) => node.classList.toggle("hidden", smsGate));
  document.querySelectorAll(".preset-bearer").forEach((node) => {
    node.classList.toggle("hidden", smsGate || $("authMode").value !== "bearer");
  });
  document.querySelectorAll(".preset-basic").forEach((node) => {
    node.classList.toggle("hidden", $("authMode").value !== "basic");
  });

  const basic = $("authMode").value === "basic";
  const saved = Boolean(state.settings?.hasAuthToken);
  $("authTokenLabel").textContent = basic ? "Gateway password" : "Gateway token";
  $("authToken").placeholder = saved
    ? `Saved ${basic ? "password" : "token"} exists - leave blank to keep`
    : basic
      ? "Enter the gateway password"
      : "No token saved";
}

function fillSettings(settings) {
  state.settings = settings;
  const map = {
    gatewayPreset: settings.gatewayPreset,
    gatewayUrl: settings.gatewayUrl,
    gatewayMethod: settings.gatewayMethod,
    gatewayContentType: settings.gatewayContentType,
    authMode: settings.authMode,
    authUsername: settings.authUsername,
    authHeader: settings.authHeader,
    authTokenPrefix: settings.authTokenPrefix,
    toField: settings.toField,
    messageField: settings.messageField,
    deviceField: settings.deviceField,
    deviceId: settings.deviceId,
    senderField: settings.senderField,
    senderId: settings.senderId,
    dailyCap: settings.dailyCap,
    delayMs: settings.delayMs,
    batchSize: settings.batchSize,
    batchPauseMs: settings.batchPauseMs,
    maxAttempts: settings.maxAttempts,
    cooldownDays: settings.cooldownDays,
    schoolName: settings.schoolName,
    defaultTemplate: settings.defaultTemplate
  };
  for (const [id, value] of Object.entries(map)) {
    const node = $(id);
    if (node) node.value = value ?? "";
  }
  $("authToken").value = "";
  applyGatewayPresetUI(false);
  const basic = $("authMode").value === "basic";
  $("gatewayTokenState").textContent = settings.hasAuthToken
    ? basic
      ? "Password saved"
      : "Token saved"
    : basic
      ? "No gateway password"
      : "No gateway token";
  if (!$("templateInput").value) $("templateInput").value = settings.template || settings.defaultTemplate;
}

function settingsFromForm() {
  return {
    gatewayPreset: $("gatewayPreset").value,
    gatewayUrl: $("gatewayUrl").value,
    gatewayMethod: $("gatewayMethod").value,
    gatewayContentType: $("gatewayContentType").value,
    authMode: $("authMode").value,
    authUsername: $("authUsername").value,
    authHeader: $("authHeader").value,
    authTokenPrefix: $("authTokenPrefix").value,
    toField: $("toField").value,
    messageField: $("messageField").value,
    deviceField: $("deviceField").value,
    deviceId: $("deviceId").value,
    senderField: $("senderField").value,
    senderId: $("senderId").value,
    dailyCap: Number($("dailyCap").value),
    delayMs: Number($("delayMs").value),
    batchSize: Number($("batchSize").value),
    batchPauseMs: Number($("batchPauseMs").value),
    maxAttempts: Number($("maxAttempts").value),
    cooldownDays: Number($("cooldownDays").value),
    schoolName: $("schoolName").value,
    template: $("defaultTemplate").value
  };
}

async function loadYears() {
  const years = await call("academicYears");
  state.years = years;
  fillYears(years);
}

async function loadCampaigns() {
  const boot = await call("bootstrap");
  state.bootstrap = boot;
  state.sentToday = boot.sentToday;
  setErpStatus(boot.erpTokenAvailable);
  fillSettings(boot.settings);
  if (!state.campaignId && boot.campaigns.length) {
    state.campaignId = boot.campaigns[0].id;
  }
  if (state.campaignId) {
    await refreshCampaign();
  }
}

async function refreshCampaign() {
  if (!state.campaignId) return;
  const data = await call("state", state.campaignId);
  state.sentToday = data.sentToday;
  setErpStatus(data.erpTokenAvailable);
  renderCampaign(data.campaign);
  state.recipients = data.recipients || [];
  renderQueue(true);
}

async function loadStudents() {
  const filter = {
    academicYearId: $("yearSelect").value,
    className: $("classInput").value.trim(),
    section: $("sectionInput").value.trim(),
    q: $("searchInput").value.trim(),
    dueOnly: $("dueOnly").checked,
    max: Number($("maxStudents").value || 500)
  };
  if (!filter.academicYearId) {
    setNotice("Select an academic year first.", "error");
    return;
  }
  state.busy = true;
  setNotice("Loading students from ERP...");
  try {
    const result = await call("students", filter);
    state.students = result.students || [];
    state.selected = new Set();
    renderStudents();
    setNotice(
      result.truncated
        ? `Loaded ${state.students.length} students (capped at ${filter.max}).`
        : `Loaded ${state.students.length} students.`,
      "ok"
    );
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    state.busy = false;
  }
}

async function createCampaign() {
  const students = state.students.filter((student) => state.selected.has(String(student.id)));
  if (!students.length) {
    setNotice("Select at least one student.", "error");
    return;
  }
  state.busy = true;
  setNotice("Creating campaign...");
  try {
    const result = await call("createCampaign", {
      name: $("campaignName").value.trim() || `SMS campaign ${new Date().toLocaleDateString()}`,
      channel: "sms",
      template: $("templateInput").value,
      filters: {
        academicYearId: $("yearSelect").value,
        className: $("classInput").value.trim(),
        section: $("sectionInput").value.trim(),
        dueOnly: $("dueOnly").checked
      },
      students
    });

    state.campaignId = result.campaign.id;
    state.sentToday = result.campaign.counts?.sent || state.sentToday;
    renderCampaign(result.campaign);
    await refreshCampaign();
    switchTab("queue");
    renderQueue(true);

    const parts = [`${result.campaign.total} parent message(s) queued`];
    if (result.duplicates?.length) parts.push(`${result.duplicates.length} duplicate(s) skipped`);
    if (result.skipped?.length) parts.push(`${result.skipped.length} invalid number(s) skipped`);
    if (result.overflow) parts.push(`${result.overflow} over the 500 limit skipped`);
    setNotice(parts.join(". "), "ok");
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    state.busy = false;
  }
}

async function withBusy(action, message) {
  state.busy = true;
  setNotice(message);
  try {
    await action();
    await refreshCampaign();
    setNotice("", "");
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    state.busy = false;
  }
}

async function saveSettings() {
  state.busy = true;
  setNotice("Saving gateway settings...");
  try {
    const token = $("authToken").value.trim();
    const saved = await call("saveSettings", settingsFromForm(), token || undefined);
    fillSettings(saved);
    state.settings = saved;
    setNotice("Gateway settings saved.", "ok");
  } catch (error) {
    setNotice(error.message, "error");
  } finally {
    state.busy = false;
  }
}

async function testGateway() {
  state.busy = true;
  $("testResult").textContent = "Sending test...";
  try {
    const token = $("authToken").value.trim();
    const saved = await call("saveSettings", settingsFromForm(), token || undefined);
    fillSettings(saved);
    const result = await call("testGateway", {
      to: $("testTo").value.trim(),
      message: $("testMessage").value.trim()
    });
    $("testResult").textContent = JSON.stringify(result, null, 2);
    setNotice(result.ok ? "Test SMS accepted by the gateway." : result.error, result.ok ? "ok" : "error");
  } catch (error) {
    $("testResult").textContent = error.message;
    setNotice(error.message, "error");
  } finally {
    state.busy = false;
  }
}

async function exportCsv() {
  if (!state.campaignId) return;
  try {
    const rows = await call("exportCampaign", state.campaignId);
    if (!rows.length) {
      setNotice("Nothing to export.", "error");
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
    ].join("\r\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sms-campaign-${state.campaignId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice("CSV exported.", "ok");
  } catch (error) {
    setNotice(error.message, "error");
  }
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
  $("openErpBtn").addEventListener("click", () => call("openErp").catch((error) => setNotice(error.message, "error")));
  $("refreshBtn").addEventListener("click", async () => {
    try {
      await loadYears();
      await loadCampaigns();
      setNotice("Refreshed.", "ok");
    } catch (error) {
      setNotice(error.message, "error");
    }
  });
  $("loadStudentsBtn").addEventListener("click", loadStudents);
  $("selectAllBtn").addEventListener("click", () => {
    state.selected = new Set(state.students.map((student) => String(student.id)));
    renderStudents();
  });
  $("clearSelectionBtn").addEventListener("click", () => {
    state.selected = new Set();
    renderStudents();
  });
  $("tableSelectAll").addEventListener("change", (event) => {
    if (event.target.checked) {
      state.selected = new Set(state.students.map((student) => String(student.id)));
    } else {
      state.selected = new Set();
    }
    renderStudents();
  });
  $("templateInput").addEventListener("input", updateSelection);
  $("createCampaignBtn").addEventListener("click", createCampaign);
  $("startBtn").addEventListener("click", () =>
    withBusy(() => call("startCampaign", state.campaignId), "Starting campaign...")
  );
  $("pauseBtn").addEventListener("click", () =>
    withBusy(() => call("pauseCampaign", state.campaignId), "Pausing...")
  );
  $("resumeBtn").addEventListener("click", () =>
    withBusy(() => call("resumeCampaign", state.campaignId), "Resuming...")
  );
  $("retryBtn").addEventListener("click", () =>
    withBusy(() => call("retryFailed", state.campaignId), "Retrying failed messages...")
  );
  $("queueFilter").addEventListener("change", () => renderQueue(true));
  $("exportBtn").addEventListener("click", exportCsv);
  $("saveSettingsBtn").addEventListener("click", saveSettings);
  $("gatewayPreset").addEventListener("change", () => applyGatewayPresetUI(true));
  $("authMode").addEventListener("change", () => applyGatewayPresetUI(false));
  $("clearTokenBtn").addEventListener("click", async () => {
    try {
      const saved = await call("clearAuthToken");
      fillSettings(saved);
      setNotice("Saved gateway token cleared.", "ok");
    } catch (error) {
      setNotice(error.message, "error");
    }
  });
  $("testGatewayBtn").addEventListener("click", testGateway);
  document.querySelectorAll(".placeholder").forEach((button) => {
    button.addEventListener("click", () => {
      const textarea = $("templateInput");
      const text = button.dataset.placeholder || "";
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      updateSelection();
    });
  });
}

async function init() {
  bindEvents();
  switchTab("campaign");
  if (!window.agent) {
    setNotice("Desktop bridge unavailable. Close and reopen the desktop app.", "error");
    return;
  }

  try {
    const boot = await call("bootstrap");
    state.bootstrap = boot;
    setErpStatus(boot.erpTokenAvailable);
    fillSettings(boot.settings);
    $("templateInput").value = boot.settings.template || boot.settings.defaultTemplate;
    await loadYears();
    await loadCampaigns();
    setNotice(
      boot.erpTokenAvailable
        ? "Connected to ERP. Load students to create a campaign."
        : "Sign in to the ERP, open Dashboard once, then click Refresh here.",
      boot.erpTokenAvailable ? "ok" : ""
    );
  } catch (error) {
    setNotice(error.message, "error");
  }

  setInterval(async () => {
    if (!state.campaignId || state.busy) return;
    try {
      const data = await call("state", state.campaignId);
      state.sentToday = data.sentToday;
      setErpStatus(data.erpTokenAvailable);
      renderCampaign(data.campaign);
      state.recipients = data.recipients || [];
      renderQueue();
    } catch {
      // Polling errors are shown only when the operator acts.
    }
  }, 2000);
}

document.addEventListener("DOMContentLoaded", init);
