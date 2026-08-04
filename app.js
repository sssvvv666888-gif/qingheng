const STORAGE_KEY = "qingheng-mvp-v1";

const defaults = {
  profile: null,
  settings: {
    currentWeight: null,
    goalWeight: null,
    height: null,
    energyTarget: 1850,
    activityTarget: 30,
    waterTarget: 1800,
    stepsTarget: 8000
  },
  tasks: [
    { id: "balanced-meal", title: "安排一顿均衡饮食", hint: "主食、蛋白质和蔬菜都留位置", done: false },
    { id: "walk", title: "活动 30 分钟", hint: "散步、骑行或你喜欢的运动", done: false },
    { id: "sleep", title: "给睡眠留够时间", hint: "睡前半小时放下屏幕", done: false }
  ],
  logs: []
};

let state = loadState();
let activeFilter = "all";

const logConfig = {
  meal: { title: "记录一餐", label: "估算能量（kcal）", min: 0, max: 5000, step: 10, placeholder: "例如 520", unit: "kcal", symbol: "食", name: "饮食" },
  activity: { title: "记录活动", label: "活动时长（分钟）", min: 1, max: 600, step: 1, placeholder: "例如 30", unit: "分钟", symbol: "动", name: "运动" },
  water: { title: "记录饮水", label: "饮水量（ml）", min: 1, max: 5000, step: 50, placeholder: "例如 250", unit: "ml", symbol: "水", name: "饮水" },
  weight: { title: "记录体重", label: "体重（kg）", min: 30, max: 300, step: 0.1, placeholder: "例如 67.2", unit: "kg", symbol: "重", name: "体重" },
  steps: { unit: "步", symbol: "步", name: "步数" },
  video: { unit: "kcal", symbol: "练", name: "视频跟练" }
};

let videoUrl = "";
let videoPlatform = "";
let watchedSeconds = 0;
let playStartedAt = null;
let videoTicker = null;
let caloriesEdited = false;

function daysAgo(days, hour = 8) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function todayAt(hour, minute) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.settings || !Array.isArray(saved.logs) || !Array.isArray(saved.tasks)) return structuredClone(defaults);
    return {
      ...structuredClone(defaults),
      ...saved,
      settings: { ...defaults.settings, ...saved.settings },
      profile: saved.profile || null,
      tasks: saved.tasks,
      logs: saved.logs
    };
  } catch {
    return structuredClone(defaults);
  }
}

function hasCompletedProfile() {
  const profile = state.profile;
  return Boolean(
    profile?.avatar && String(profile.name || "").trim() && String(profile.signature || "").trim()
    && Number(profile.currentWeight) > 0 && Number(profile.goalWeight) > 0 && Number(profile.height) > 0
  );
}

function saveState(message = "已自动保存") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const stamp = document.querySelector("#last-saved");
  if (stamp) stamp.textContent = message;
}

function isToday(iso) {
  const date = new Date(iso);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function sumToday(type) {
  return state.logs.filter(log => log.type === type && isToday(log.at)).reduce((sum, log) => sum + Number(log.value), 0);
}

function todayActivityMinutes() {
  const regular = sumToday("activity");
  const video = state.logs
    .filter(log => log.type === "video" && isToday(log.at))
    .reduce((sum, log) => sum + Number(log.duration || 0), 0);
  return regular + video;
}

function todayBurnCalories() {
  return state.logs
    .filter(log => (log.type === "video" || log.type === "activity") && isToday(log.at))
    .reduce((sum, log) => sum + Number(log.calories ?? (log.type === "video" ? log.value : 0) ?? 0), 0);
}

function setView(name) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("is-active", view.id === `view-${name}`));
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("is-active", button.dataset.view === name));
  const view = document.querySelector(`#view-${name}`);
  document.querySelector("#view-title").textContent = name === "today" && hasCompletedProfile() ? greetingTitle() : (view?.dataset.title || "轻衡");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "records") renderTimeline();
  if (name === "today") renderInsights();
  if (name === "profile") fillSettings();
}

function greetingTitle() {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  return `${greeting}，${state.profile?.name || ""}`;
}

function renderProfileSummary() {
  if (!hasCompletedProfile()) return;
  const profile = state.profile;
  setText("hero-user-name", profile.name);
  setText("hero-signature", profile.signature);
  setText("home-profile-name", profile.name);
  setText("home-profile-signature", profile.signature);
  setText("home-current-weight", formatValue(profile.currentWeight));
  setText("home-goal-weight", formatValue(profile.goalWeight));
  setText("home-weight-distance", formatValue(Math.abs(Number(profile.currentWeight) - Number(profile.goalWeight))));
  setText("profile-display-name", profile.name);
  setText("profile-display-signature", profile.signature);
  setText("profile-current-weight", formatValue(profile.currentWeight));
  setText("profile-goal-weight", formatValue(profile.goalWeight));
  setText("profile-height", formatValue(profile.height));
  document.querySelector("#view-today").dataset.title = greetingTitle();
  if (document.querySelector("#view-today").classList.contains("is-active")) setText("view-title", greetingTitle());

  for (const id of ["topbar-avatar", "home-profile-avatar", "profile-avatar-image"]) {
    const image = document.getElementById(id);
    if (image) {
      image.src = profile.avatar;
      image.hidden = false;
    }
  }
  const fallback = document.querySelector("#topbar-avatar-fallback");
  if (fallback) fallback.hidden = true;
}

function renderDashboard() {
  const energy = sumToday("meal");
  const activity = todayActivityMinutes();
  const water = sumToday("water");
  const steps = todaySteps();
  const burned = todayBurnCalories();
  const { energyTarget, activityTarget, waterTarget, stepsTarget } = state.settings;

  setText("energy-value", Math.round(energy));
  setText("activity-value", Math.round(activity));
  setText("water-value", Math.round(water));
  setText("energy-target", energyTarget);
  setText("activity-target", activityTarget);
  setText("water-target", waterTarget);
  setBar("energy-bar", energy / energyTarget);
  setBar("activity-bar", activity / activityTarget);
  setBar("water-bar", water / waterTarget);
  setText("steps-value", Math.round(steps).toLocaleString("zh-CN"));
  setText("steps-goal-copy", `目标 ${Math.round(stepsTarget).toLocaleString("zh-CN")} 步`);
  setBar("steps-bar", steps / stepsTarget);
  const stepsInput = document.querySelector("#steps-input");
  if (stepsInput && document.activeElement !== stepsInput) stepsInput.value = String(Math.round(steps));
  setText("video-burn", Math.round(currentEstimatedCalories()));
  setText("today-burn", Math.round(burned));
  setText("intake-calories", Math.round(energy));
  setText("burn-calories", Math.round(burned));
  setText("calorie-gap", `${energy >= burned ? "摄入多" : "支出多"} ${Math.round(Math.abs(energy - burned))} kcal`);
  const calorieScale = Math.max(energy, burned, 1);
  setBar("intake-calorie-bar", energy / calorieScale);
  setBar("burn-calorie-bar", burned / calorieScale);

  const done = state.tasks.filter(task => task.done).length;
  const completion = state.tasks.length ? Math.round((done / state.tasks.length) * 100) : 0;
  setText("task-count", `${done} / ${state.tasks.length}`);
  setText("weekly-percent", `${completion}%`);
  document.querySelector("#weekly-ring").style.strokeDashoffset = String(345.6 * (1 - completion / 100));
  renderTasks();
  renderTodayMeals();
  renderProfileSummary();
}

function renderTodayMeals() {
  const container = document.querySelector("#today-meals");
  if (!container) return;
  const meals = state.logs.filter(log => log.type === "meal" && isToday(log.at)).sort((a, b) => new Date(a.at) - new Date(b.at));
  if (!meals.length) {
    container.innerHTML = '<div class="meal-empty">还没有饮食记录，拍下今天的第一餐吧 🍓</div>';
    return;
  }
  container.innerHTML = meals.map(log => `
    <article class="meal-card">
      <div class="meal-photo">${log.image ? `<img src="${log.image}" alt="${escapeHtml(log.mealType || "饮食")}图片">` : '<span aria-hidden="true">🍓</span>'}</div>
      <div class="meal-card-copy">
        <span>${escapeHtml(log.mealType || "饮食")}</span>
        <strong>${escapeHtml(log.foodName || log.note || "已记录一餐")}</strong>
        <small>${Math.round(Number(log.value) || 0)} kcal · ${formatMealDate(log)}</small>
        ${log.note && log.foodName ? `<p>${escapeHtml(log.note)}</p>` : ""}
        <div class="meal-card-actions"><button type="button" data-edit-meal="${log.id}">编辑</button><button type="button" data-delete-meal="${log.id}">删除</button></div>
      </div>
    </article>`).join("");
}

function formatMealDate(log) {
  const date = new Date(log.at);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function renderTasks() {
  const list = document.querySelector("#task-list");
  if (!state.tasks.length) {
    list.innerHTML = '<div class="empty-state">点击“编辑计划”，写下今天想完成的小事。</div>';
    return;
  }
  list.innerHTML = state.tasks.map(task => `
    <label class="task-item">
      <input type="checkbox" data-task="${task.id}" ${task.done ? "checked" : ""}>
      <span class="task-check">✓</span>
      <div><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.hint)}</small></div>
    </label>`).join("");
}

function taskEditorRow(task = {}, index = 0) {
  const id = task.id || `task-${Date.now()}-${index}`;
  return `<div class="task-editor-row" data-task-editor-row>
    <input type="hidden" name="taskId" value="${escapeHtml(id)}">
    <label>任务内容<input type="text" name="taskTitle" maxlength="36" value="${escapeHtml(task.title || "")}" placeholder="例如：阅读 20 分钟" required></label>
    <label>小提示（可选）<input type="text" name="taskHint" maxlength="60" value="${escapeHtml(task.hint || "")}" placeholder="例如：读完今天这一章"></label>
    <button class="task-remove-row" type="button" data-remove-task-row aria-label="删除这项任务">×</button>
  </div>`;
}

function openTaskEditor() {
  const list = document.querySelector("#task-editor-list");
  const tasks = state.tasks.length ? state.tasks : [{}];
  list.innerHTML = tasks.map(taskEditorRow).join("");
  document.querySelector("#task-dialog").showModal();
}

function addTaskEditorRow() {
  const list = document.querySelector("#task-editor-list");
  if (list.querySelectorAll("[data-task-editor-row]").length >= 10) {
    showToast("轻计划最多设置 10 项");
    return;
  }
  list.insertAdjacentHTML("beforeend", taskEditorRow({}, list.children.length));
  list.lastElementChild.querySelector('[name="taskTitle"]').focus();
}

function removeTaskEditorRow(button) {
  const list = document.querySelector("#task-editor-list");
  if (list.querySelectorAll("[data-task-editor-row]").length <= 1) {
    showToast("至少保留一项轻计划");
    return;
  }
  button.closest("[data-task-editor-row]").remove();
}

function submitTaskEditor(event) {
  event.preventDefault();
  const previousTasks = new Map(state.tasks.map(task => [String(task.id), task]));
  const rows = [...document.querySelectorAll("#task-editor-list [data-task-editor-row]")];
  state.tasks = rows.map((row, index) => {
    const id = String(row.querySelector('[name="taskId"]').value || `task-${Date.now()}-${index}`);
    return {
      id,
      title: row.querySelector('[name="taskTitle"]').value.trim(),
      hint: row.querySelector('[name="taskHint"]').value.trim(),
      done: Boolean(previousTasks.get(id)?.done)
    };
  });
  saveState("轻计划已保存");
  renderDashboard();
  renderInsights();
  document.querySelector("#task-dialog").close();
  showToast(`已设置 ${state.tasks.length} 项轻计划`);
}

function toggleWeightChart(button) {
  const panel = document.querySelector("#weight-chart-panel");
  const shouldExpand = panel.hidden;
  panel.hidden = !shouldExpand;
  button.setAttribute("aria-expanded", String(shouldExpand));
  button.setAttribute("aria-label", shouldExpand ? "收起体重折线图" : "展开体重折线图");
}

function renderTimeline() {
  const timeline = document.querySelector("#timeline");
  const logs = [...state.logs]
    .filter(log => activeFilter === "all" || log.type === activeFilter)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  if (!logs.length) {
    timeline.innerHTML = '<div class="empty-state">这里还没有记录。先从一个小行动开始吧。</div>';
    return;
  }

  timeline.innerHTML = logs.map(log => {
    const config = logConfig[log.type];
    const date = new Date(log.at);
    const dateText = isToday(log.at) ? `今天 ${formatTime(date)}` : `${date.getMonth() + 1}月${date.getDate()}日 ${formatTime(date)}`;
    const valueText = log.type === "video"
      ? `${formatDuration((Number(log.duration) || 0) * 60)} · ${Math.round(Number(log.calories ?? log.value ?? 0))} kcal`
      : log.type === "activity" && Number(log.calories) > 0
        ? `${formatValue(log.value)} 分钟 · ${Math.round(Number(log.calories))} kcal`
      : `${formatValue(log.value)} ${config.unit}`;
    return `<article class="timeline-item ${log.type === "meal" ? "meal-timeline-item" : ""}">
      <time class="timeline-time">${dateText}</time>
      <span class="timeline-symbol">${config.symbol}</span>
      <div class="timeline-copy"><strong>${log.type === "meal" ? `${escapeHtml(log.mealType || config.name)} · ${escapeHtml(log.foodName || "饮食记录")}` : config.name}</strong><small>${escapeHtml(log.note || "已记录")}</small></div>
      <span class="timeline-value">${valueText}</span>
      ${log.type === "meal" ? `<div class="timeline-actions"><button type="button" data-edit-meal="${log.id}">编辑</button><button type="button" data-delete-meal="${log.id}">删除</button></div>` : ""}
    </article>`;
  }).join("");
}

function renderInsights() {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6);
  const latestWeightByDay = new Map();
  state.logs
    .filter(log => log.type === "weight" && new Date(log.at) >= cutoff)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .forEach(log => latestWeightByDay.set(dateInputValue(log.at), log));
  const weights = [...latestWeightByDay.values()];
  if (!weights.length && Number(state.profile?.currentWeight) > 0) {
    weights.push({ type: "weight", value: Number(state.profile.currentWeight), at: new Date().toISOString() });
  }
  const change = weights.length > 1 ? Number(weights.at(-1).value) - Number(weights[0].value) : null;
  setText("weight-change", change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`);
  const completedTasks = state.tasks.filter(task => task.done).length;
  setText("insight-completion", completedTasks ? `${Math.round(completedTasks / state.tasks.length * 100)}%` : "—");
  const allActivity = state.logs.reduce((sum, log) => {
    if (log.type === "activity") return sum + Number(log.value || 0);
    if (log.type === "video") return sum + Number(log.duration || 0);
    return sum;
  }, 0);
  setText("insight-activity", allActivity > 0 ? `${Math.round(allActivity)} 分钟` : "—");
  renderWeightChart(weights);
}

function renderWeightChart(weights) {
  const container = document.querySelector("#weight-chart");
  if (!weights.length) {
    container.innerHTML = '<div class="empty-state">记录体重后，这里会显示长期趋势。</div>';
    return;
  }

  const width = 760;
  const height = 260;
  const pad = { x: 42, y: 28 };
  const values = weights.map(item => Number(item.value));
  const min = Math.min(...values) - 0.4;
  const max = Math.max(...values) + 0.4;
  const xStep = weights.length === 1 ? 0 : (width - pad.x * 2) / (weights.length - 1);
  const y = value => pad.y + (max - value) / Math.max(max - min, 1) * (height - pad.y * 2);
  const points = weights.map((item, index) => `${pad.x + index * xStep},${y(Number(item.value))}`);
  const areaPoints = `${pad.x},${height - pad.y} ${points.join(" ")} ${pad.x + (weights.length - 1) * xStep},${height - pad.y}`;

  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="最近体重趋势">
    <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9ead9" stop-opacity=".7"/><stop offset="1" stop-color="#c9ead9" stop-opacity="0"/></linearGradient></defs>
    ${[0,1,2,3].map(i => `<line class="chart-grid" x1="${pad.x}" y1="${pad.y + i * (height - pad.y * 2) / 3}" x2="${width - pad.x}" y2="${pad.y + i * (height - pad.y * 2) / 3}"/>`).join("")}
    <polygon class="chart-area" points="${areaPoints}"/>
    <polyline class="chart-line" points="${points.join(" ")}"/>
    ${weights.map((item, index) => {
      const date = new Date(item.at);
      const x = pad.x + index * xStep;
      return `<circle class="chart-dot" cx="${x}" cy="${y(Number(item.value))}" r="5"/><text class="chart-label" x="${x}" y="${height - 4}" text-anchor="middle">${date.getMonth()+1}/${date.getDate()}</text><text class="chart-label" x="${x}" y="${y(Number(item.value))-12}" text-anchor="middle">${Number(item.value).toFixed(1)}</text>`;
    }).join("")}
  </svg>`;
}

function todayStepsLog() {
  return [...state.logs]
    .filter(log => log.type === "steps" && isToday(log.at))
    .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
}

function todaySteps() {
  return Number(todayStepsLog()?.value || 0);
}

function saveTodaySteps() {
  const input = document.querySelector("#steps-input");
  const value = Math.max(0, Math.min(100000, Math.round(Number(input.value) || 0)));
  const existing = todayStepsLog();
  if (existing) {
    existing.value = value;
    existing.at = new Date().toISOString();
    existing.note = "今日步数";
  } else {
    state.logs.push({ id: Date.now(), type: "steps", value, note: "今日步数", at: new Date().toISOString() });
  }
  saveState("步数已保存");
  renderDashboard();
  renderTimeline();
  showToast(`今天已记录 ${value.toLocaleString("zh-CN")} 步`);
}

function addSteps(amount) {
  const input = document.querySelector("#steps-input");
  input.value = String(Math.min(100000, Math.max(0, Number(input.value || todaySteps()) + amount)));
  input.focus();
}

function detectVideoPlatform(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host === "douyin.com" || host.endsWith(".douyin.com")) return "抖音";
    if (host === "xiaohongshu.com" || host.endsWith(".xiaohongshu.com") || host === "xhslink.com" || host.endsWith(".xhslink.cn")) return "小红书";
    if (host === "bilibili.com" || host.endsWith(".bilibili.com") || host === "b23.tv") return "哔哩哔哩";
  } catch {}
  return "";
}

function updateVideoLink() {
  const input = document.querySelector("#video-url");
  const value = input.value.trim();
  const platform = detectVideoPlatform(value);
  videoUrl = platform ? value : "";
  videoPlatform = platform;
  setText("video-platform-badge", platform || (value ? "链接暂不支持" : "支持三平台"));
  document.querySelector("#open-video-link").disabled = !platform;
  document.querySelector("#start-video-timer").disabled = !platform || playStartedAt !== null;
  document.querySelector("#pause-video-timer").disabled = playStartedAt === null;
  document.querySelector("#reset-video-timer").disabled = !platform || activeWatchedSeconds() < 1;
  updateVideoStats();
}

function openVideoLink() {
  if (!videoUrl) return;
  window.open(videoUrl, "_blank", "noopener,noreferrer");
}

function activeWatchedSeconds() {
  return watchedSeconds + (playStartedAt === null ? 0 : Math.max(0, (performance.now() - playStartedAt) / 1000));
}

function estimatedCalories(seconds = activeWatchedSeconds()) {
  const met = Number(document.querySelector("#video-intensity")?.value || 6);
  const weight = Number(state.settings.currentWeight || 0);
  return Math.max(0, met * 3.5 * weight / 200 * (seconds / 60));
}

function currentEstimatedCalories() {
  const input = document.querySelector("#video-calories-input");
  if (caloriesEdited && input) return Math.max(0, Number(input.value) || 0);
  return estimatedCalories();
}

function updateVideoStats() {
  const seconds = activeWatchedSeconds();
  setText("video-time", formatDuration(seconds));
  const calories = Math.round(estimatedCalories(seconds));
  const input = document.querySelector("#video-calories-input");
  if (input && !caloriesEdited) input.value = String(calories);
  setText("video-burn", Math.round(currentEstimatedCalories()));
  const saveButton = document.querySelector("#save-video-session");
  if (saveButton) saveButton.disabled = !videoPlatform || seconds < 1;
  const start = document.querySelector("#start-video-timer");
  const pause = document.querySelector("#pause-video-timer");
  const reset = document.querySelector("#reset-video-timer");
  if (start) start.disabled = !videoPlatform || playStartedAt !== null;
  if (pause) pause.disabled = playStartedAt === null;
  if (reset) reset.disabled = !videoPlatform || seconds < 1;
}

function startVideoTimer() {
  if (!videoPlatform || playStartedAt !== null) return;
  playStartedAt = performance.now();
  clearInterval(videoTicker);
  videoTicker = setInterval(updateVideoStats, 500);
  updateVideoStats();
}

function stopVideoTimer() {
  if (playStartedAt !== null) {
    watchedSeconds += Math.max(0, (performance.now() - playStartedAt) / 1000);
    playStartedAt = null;
  }
  clearInterval(videoTicker);
  videoTicker = null;
  updateVideoStats();
}

function resetVideoSession() {
  clearInterval(videoTicker);
  videoTicker = null;
  watchedSeconds = 0;
  playStartedAt = null;
  caloriesEdited = false;
  const input = document.querySelector("#video-calories-input");
  if (input) input.value = "0";
  updateVideoStats();
}

function saveVideoSession() {
  stopVideoTimer();
  const seconds = activeWatchedSeconds();
  if (seconds < 1) {
    showToast("先开始计时，跟练时间才会被记录");
    return;
  }
  const duration = Math.max(0.1, Math.round(seconds / 6) / 10);
  const calories = Math.max(0, Math.round(currentEstimatedCalories()));
  const select = document.querySelector("#video-intensity");
  const intensity = select.options[select.selectedIndex]?.text || "视频跟练";
  state.logs.push({
    id: Date.now(),
    type: "video",
    value: calories,
    calories,
    duration,
    platform: videoPlatform,
    url: videoUrl,
    note: `${videoPlatform} · ${intensity}`,
    at: new Date().toISOString()
  });
  saveState("跟练已保存");
  renderDashboard();
  renderTimeline();
  renderInsights();
  showToast(`已记录 ${formatDuration(seconds)} 跟练 · ${calories} kcal`);
  resetVideoSession();
}

function openLogDialog(type, editId = "") {
  const config = logConfig[type];
  const form = document.querySelector("#log-form");
  form.reset();
  form.elements.type.value = type;
  form.elements.editId.value = editId;
  const editingLog = editId ? state.logs.find(log => String(log.id) === String(editId) && log.type === type) : null;
  document.querySelector("#dialog-title").textContent = editingLog ? "修改饮食记录" : config.title;
  let fields = `<label>${config.label}<input type="number" name="value" min="${config.min}" max="${config.max}" step="${config.step}" placeholder="${config.placeholder}" ${editingLog ? `value="${escapeHtml(editingLog.value)}"` : ""} required></label>`;
  if (type === "meal") {
    const mealDate = editingLog?.date || dateInputValue(editingLog?.at || new Date().toISOString());
    const mealType = editingLog?.mealType === "加餐" ? "零食" : (editingLog?.mealType || "早餐");
    fields = `
      <label>日期<input type="date" name="date" value="${mealDate}" required></label>
      <label>类型<select name="mealType" required>${["早餐", "午餐", "晚餐", "零食"].map(option => `<option ${option === mealType ? "selected" : ""}>${option}</option>`).join("")}</select></label>
      <label class="food-name-field">食物名称<input type="text" name="foodName" maxlength="40" value="${escapeHtml(editingLog?.foodName || "")}" placeholder="例如：草莓酸奶碗" required></label>
      ${fields}
      <label>餐食图片（可选）<input type="file" name="image" accept="image/*"><small class="field-hint">${editingLog?.image ? "已保留原图片；选择新图后会覆盖。" : "图片会压缩后保存在当前浏览器，不会上传。"}</small></label>`;
  }
  if (type === "activity") fields += '<label>消耗热量（kcal，可选）<input type="number" name="calories" min="0" max="5000" step="1" placeholder="例如 120"></label>';
  document.querySelector("#dynamic-fields").innerHTML = fields;
  form.elements.note.value = editingLog?.note || "";
  document.querySelector("#log-dialog").showModal();
}

function dateInputValue(iso) {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function resizeMealImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.size) return resolve("");
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 720 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", .78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image decode failed"));
    };
    image.src = objectUrl;
  });
}

async function submitLog(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const type = form.get("type");
  const editId = String(form.get("editId") || "");
  const existing = editId ? state.logs.find(log => String(log.id) === editId && log.type === type) : null;
  const value = Number(form.get("value"));
  if (!Number.isFinite(value)) return;
  let image = "";
  if (type === "meal") {
    try {
      image = await resizeMealImage(form.get("image"));
    } catch {
      showToast("图片读取失败，请换一张再试");
      return;
    }
  }
  const log = { id: Date.now(), type, value, note: String(form.get("note") || "").trim(), at: new Date().toISOString() };
  if (type === "meal") {
    log.mealType = String(form.get("mealType") || "饮食");
    log.foodName = String(form.get("foodName") || "").trim();
    log.date = String(form.get("date") || dateInputValue(log.at));
    log.at = new Date(`${log.date}T12:00:00`).toISOString();
    log.image = image || existing?.image || "";
  }
  if (type === "activity") log.calories = Math.max(0, Number(form.get("calories")) || 0);
  if (existing) Object.assign(existing, log, { id: existing.id });
  else state.logs.push(log);
  if (type === "weight") {
    state.settings.currentWeight = value;
    if (state.profile) state.profile.currentWeight = value;
  }
  saveState("刚刚保存");
  document.querySelector("#log-dialog").close();
  renderDashboard();
  renderTimeline();
  renderInsights();
  showToast(existing ? "饮食记录已更新" : `${logConfig[type].name}记录已保存`);
}

function deleteMealRecord(id) {
  const meal = state.logs.find(log => String(log.id) === String(id) && log.type === "meal");
  if (!meal || !window.confirm(`删除“${meal.foodName || meal.note || "这条饮食"}”记录吗？`)) return;
  state.logs = state.logs.filter(log => log !== meal);
  saveState("饮食记录已删除");
  renderDashboard();
  renderTimeline();
  showToast("饮食记录已删除");
}

function fillSettings() {
  const form = document.querySelector("#settings-form");
  if (state.profile) {
    for (const key of ["name", "signature", "currentWeight", "goalWeight", "height"]) {
      if (form.elements[key]) form.elements[key].value = state.profile[key] ?? "";
    }
  }
  Object.entries(state.settings).forEach(([key, value]) => {
    if (form.elements[key] && value !== null && !["currentWeight", "goalWeight", "height"].includes(key)) form.elements[key].value = value;
  });
}

function resizeAvatarImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.size) return resolve("");
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const size = 360;
      const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d").drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", .82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("avatar decode failed"));
    };
    image.src = objectUrl;
  });
}

async function submitOnboarding(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const currentWeight = Number(data.get("currentWeight"));
  const goalWeight = Number(data.get("goalWeight"));
  if (goalWeight >= currentWeight) {
    showToast("目标体重应低于当前体重");
    return;
  }
  let avatar;
  try {
    avatar = await resizeAvatarImage(data.get("avatar"));
  } catch {
    showToast("头像读取失败，请重新选择");
    return;
  }
  if (!avatar) {
    showToast("请先选择头像");
    return;
  }
  state.profile = {
    avatar,
    name: String(data.get("name") || "").trim(),
    signature: String(data.get("signature") || "").trim(),
    currentWeight,
    goalWeight,
    height: Number(data.get("height"))
  };
  Object.assign(state.settings, { currentWeight, goalWeight, height: state.profile.height });
  state.logs.push({ id: Date.now(), type: "weight", value: currentWeight, note: "首次设置", at: new Date().toISOString() });
  saveState("资料已保存");
  document.querySelector("#onboarding-dialog").close();
  fillSettings();
  renderDashboard();
  renderTimeline();
  renderInsights();
  showToast(`欢迎你，${state.profile.name}`);
}

async function submitSettings(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const currentWeight = Number(data.get("currentWeight"));
  const goalWeight = Number(data.get("goalWeight"));
  const previousWeight = Number(state.profile?.currentWeight);
  if (goalWeight >= currentWeight) {
    showToast("目标体重应低于当前体重");
    return;
  }
  let avatar = state.profile?.avatar || "";
  const avatarFile = data.get("avatar");
  if (avatarFile?.size) {
    try {
      avatar = await resizeAvatarImage(avatarFile);
    } catch {
      showToast("头像读取失败，请重新选择");
      return;
    }
  }
  state.profile = {
    avatar,
    name: String(data.get("name") || "").trim(),
    signature: String(data.get("signature") || "").trim(),
    currentWeight,
    goalWeight,
    height: Number(data.get("height"))
  };
  state.settings = {
    ...state.settings,
    currentWeight,
    goalWeight,
    height: state.profile.height,
    energyTarget: Number(data.get("energyTarget")),
    activityTarget: Number(data.get("activityTarget")),
    waterTarget: Number(data.get("waterTarget")),
    stepsTarget: Number(data.get("stepsTarget"))
  };
  if (Number.isFinite(previousWeight) && previousWeight !== currentWeight) {
    state.logs.push({ id: Date.now(), type: "weight", value: currentWeight, note: "资料更新", at: new Date().toISOString() });
  }
  saveState("资料已保存");
  renderDashboard();
  renderTimeline();
  renderInsights();
  fillSettings();
  showToast("个人资料已更新");
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function setBar(id, ratio) {
  const node = document.getElementById(id);
  if (node) node.style.width = `${Math.min(Math.max(ratio, 0), 1) * 100}%`;
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatValue(value) {
  return Number(value) % 1 === 0 ? String(value) : Number(value).toFixed(1);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

let toastTimer;
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  const viewLink = event.target.closest("[data-view-link]");
  const logButton = event.target.closest("[data-log]");
  const profileButton = event.target.closest("[data-open-profile]");
  const filterButton = event.target.closest("[data-filter]");
  const closeDialogButton = event.target.closest("[data-close-dialog]");
  const addStepsButton = event.target.closest("[data-steps-add]");
  const saveStepsButton = event.target.closest("[data-save-steps]");
  const editMealButton = event.target.closest("[data-edit-meal]");
  const deleteMealButton = event.target.closest("[data-delete-meal]");
  const trendToggleButton = event.target.closest("[data-toggle-weight-chart]");
  const editTasksButton = event.target.closest("[data-edit-tasks]");
  const addTaskRowButton = event.target.closest("[data-add-task-row]");
  const removeTaskRowButton = event.target.closest("[data-remove-task-row]");

  if (viewButton) setView(viewButton.dataset.view);
  if (viewLink) setView(viewLink.dataset.viewLink);
  if (logButton) openLogDialog(logButton.dataset.log);
  if (closeDialogButton) closeDialogButton.closest("dialog")?.close();
  if (addStepsButton) addSteps(Number(addStepsButton.dataset.stepsAdd));
  if (saveStepsButton) saveTodaySteps();
  if (editMealButton) openLogDialog("meal", editMealButton.dataset.editMeal);
  if (deleteMealButton) deleteMealRecord(deleteMealButton.dataset.deleteMeal);
  if (trendToggleButton) toggleWeightChart(trendToggleButton);
  if (editTasksButton) openTaskEditor();
  if (addTaskRowButton) addTaskEditorRow();
  if (removeTaskRowButton) removeTaskEditorRow(removeTaskRowButton);
  if (profileButton) setView("profile");
  if (filterButton) {
    activeFilter = filterButton.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(button => button.classList.toggle("is-active", button === filterButton));
    renderTimeline();
  }
});

document.addEventListener("change", event => {
  const task = event.target.closest("[data-task]");
  if (!task) return;
  const item = state.tasks.find(entry => entry.id === task.dataset.task);
  if (item) item.done = task.checked;
  saveState("计划已更新");
  renderDashboard();
});

document.querySelector("#log-form").addEventListener("submit", submitLog);
document.querySelector("#task-form").addEventListener("submit", submitTaskEditor);
document.querySelector("#onboarding-form").addEventListener("submit", submitOnboarding);
document.querySelector("#onboarding-dialog").addEventListener("cancel", event => event.preventDefault());
document.querySelector("#settings-form").addEventListener("submit", submitSettings);
document.querySelector("#video-url").addEventListener("input", updateVideoLink);
document.querySelector("#open-video-link").addEventListener("click", openVideoLink);
document.querySelector("#start-video-timer").addEventListener("click", startVideoTimer);
document.querySelector("#pause-video-timer").addEventListener("click", stopVideoTimer);
document.querySelector("#reset-video-timer").addEventListener("click", resetVideoSession);
document.querySelector("#video-intensity").addEventListener("change", () => {
  caloriesEdited = false;
  updateVideoStats();
});
document.querySelector("#video-calories-input").addEventListener("input", () => {
  caloriesEdited = true;
  updateVideoStats();
});
document.querySelector("#save-video-session").addEventListener("click", saveVideoSession);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopVideoTimer();
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" });
document.querySelector("#today-date").textContent = dateFormatter.format(new Date());
fillSettings();
renderDashboard();
renderTimeline();
renderInsights();
updateVideoLink();
window.CompanionSystem?.render(
  document.querySelector("#companion-options"),
  document.querySelector("#companion-preview"),
  task => showToast(`${task.label}陪伴模块已预留`)
);
if (!hasCompletedProfile()) document.querySelector("#onboarding-dialog").showModal();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      await registration.update();
    } catch {}
  });
}
