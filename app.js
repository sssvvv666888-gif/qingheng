const STORAGE_KEY = "qingheng-mvp-v1";
const APP_VERSION = "1.0.0";
const APP_UPDATED_AT = "2026.08.10";
const BACKUP_FORMAT = "qingheng-health-backup";
const UPDATE_FEEDBACK_KEY = "qingheng-update-feedback";

const defaults = {
  profile: null,
  settings: {
    currentWeight: null,
    goalWeight: null,
    height: null,
    energyTarget: 1850,
    healthGoal: "maintain",
    nutritionGoalConfigured: false,
    activityTarget: 30,
    waterTarget: 1800,
    stepsTarget: 8000
  },
  tasks: [
    { id: "balanced-meal", title: "安排一顿均衡饮食", hint: "主食、蛋白质和蔬菜都留位置", done: false },
    { id: "walk", title: "活动 30 分钟", hint: "散步、骑行或你喜欢的运动", done: false },
    { id: "water", title: "记得慢慢喝水", hint: "分几次完成今天的饮水目标", done: false }
  ],
  logs: [],
  checkIns: [],
  familySystem: {
    mode: "personal",
    family: null,
    currentMemberId: "",
    knownFeedKeys: []
  }
};

let state = loadState();
let activeFilter = "all";

const logConfig = {
  meal: { title: "记录一餐", label: "估算能量（kcal）", min: 0, max: 5000, step: 10, placeholder: "例如 520", unit: "kcal", symbol: "食", name: "饮食" },
  activity: { title: "记录运动", label: "活动时长（分钟）", min: 1, max: 600, step: 1, placeholder: "例如 30", unit: "分钟", symbol: "动", name: "运动" },
  water: { title: "记录饮水", label: "饮水量（ml）", min: 1, max: 5000, step: 50, placeholder: "例如 250", unit: "ml", symbol: "水", name: "饮水" },
  weight: { title: "记录体重", label: "体重（kg）", min: 30, max: 300, step: 0.1, placeholder: "例如 67.2", unit: "kg", symbol: "重", name: "体重" },
  steps: { unit: "步", symbol: "步", name: "步数" },
  video: { unit: "kcal", symbol: "动", name: "历史运动" }
};

let pendingAiFood = null;
let pendingCaptureImage = "";
let captureDefaultKind = "meal";
let nutritionGoalEditing = false;
let recipeAutoplayTimer = 0;
let recipeAutoplayResumeTimer = 0;
let recipeAutoplayPaused = false;
let recipeDisplayMode = "random";
let exerciseAutoplayTimer = 0;
let exerciseAutoplayResumeTimer = 0;
let exerciseAutoplayPaused = false;

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
    const family = window.FamilyHealthSystem.normalizeFamily(saved.familySystem?.family);
    return {
      ...structuredClone(defaults),
      ...saved,
      settings: { ...defaults.settings, ...saved.settings },
      profile: saved.profile ? window.UserProfileManager.normalize(saved.profile) : null,
      tasks: saved.tasks,
      logs: saved.logs,
      checkIns: window.CheckInSystem.normalize(saved.checkIns),
      familySystem: {
        mode: family && saved.familySystem?.mode === "family" ? "family" : "personal",
        family,
        currentMemberId: String(saved.familySystem?.currentMemberId || ""),
        knownFeedKeys: Array.isArray(saved.familySystem?.knownFeedKeys) ? saved.familySystem.knownFeedKeys : []
      }
    };
  } catch {
    return structuredClone(defaults);
  }
}

function hasCompletedProfile() {
  return window.UserProfileManager.isComplete(state.profile);
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
  if (name === "family") {
    state.familySystem.mode = "family";
    name = "today";
  }
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("is-active", view.id === `view-${name}`));
  document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("is-active", button.dataset.view === name));
  const view = document.querySelector(`#view-${name}`);
  document.querySelector("#view-title").textContent = name === "today" && hasCompletedProfile() ? greetingTitle() : (view?.dataset.title || "轻衡");
  const cameraButton = document.querySelector(".camera-trigger");
  const settingsButton = document.querySelector(".settings-trigger");
  if (cameraButton) cameraButton.hidden = !["nutrition", "exercise"].includes(name);
  if (settingsButton) settingsButton.hidden = name !== "profile";
  captureDefaultKind = name === "exercise" ? "activity" : "meal";
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "records") renderTimeline();
  if (name === "family") renderFamily();
  if (name === "exercise") renderExercise();
  if (name === "today") {
    renderInsights();
    renderHomeMode();
  }
  if (name === "nutrition") {
    fillNutritionGoal();
    renderNutrition();
  }
  if (name === "profile") {
    fillSettings();
    renderProfileTrends();
  }
}

function greetingTitle() {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  return `${greeting}，${state.profile?.name || ""}`;
}

function renderProfileSummary() {
  if (!hasCompletedProfile()) return;
  const profile = window.UserProfileManager.normalize(state.profile);
  const bmi = window.BMIManager.getResult(profile.currentWeight, profile.height);
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
  setText("home-bmi-value", bmi.value ?? "—");
  setText("home-bmi-status", bmi.label);
  setText("profile-bmi-value", bmi.value ?? "—");
  setText("profile-bmi-status", bmi.label);
  setText("profile-simple-name", profile.name);
  setText("profile-simple-signature", profile.signature);
  setText("profile-simple-current-weight", formatValue(profile.currentWeight));
  setText("profile-simple-goal-weight", formatValue(profile.goalWeight));
  setText("profile-simple-bmi", bmi.value ?? "—");
  document.querySelector("#view-today").dataset.title = greetingTitle();
  if (document.querySelector("#view-today").classList.contains("is-active")) setText("view-title", greetingTitle());

  for (const [imageId, fallbackId] of [
    ["topbar-avatar", "topbar-avatar-fallback"],
    ["home-profile-avatar", "home-profile-avatar-fallback"],
    ["profile-avatar-image", "profile-avatar-fallback"],
    ["profile-simple-avatar-image", "profile-simple-avatar-fallback"]
  ]) {
    renderAvatar(imageId, fallbackId, profile.avatar);
  }
  for (const id of ["hero-signature", "home-profile-signature", "profile-display-signature", "profile-simple-signature"]) {
    const signature = document.getElementById(id);
    if (signature) signature.hidden = !profile.signature;
  }
}

function trendChangeCopy(value, unit = "") {
  if (value == null) return "至少记录两次后显示变化";
  if (value === 0) return "与首次记录持平";
  return `${value > 0 ? "上升" : "下降"} ${formatValue(Math.abs(value))}${unit}`;
}

function renderProfileChart(containerId, points, key, color, label) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const values = points.map(point => Number(point[key])).filter(Number.isFinite);
  if (!values.length) {
    container.innerHTML = `<p class="profile-chart-empty">记录体重后，这里会出现${label}曲线。</p>`;
    return;
  }
  const width = 520;
  const height = 170;
  const paddingX = 34;
  const paddingY = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, key === "bmi" ? 0.6 : 1);
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? width / 2 : paddingX + index * ((width - paddingX * 2) / (points.length - 1)),
    y: paddingY + ((max + spread * .18 - Number(point[key])) / (spread * 1.36)) * (height - paddingY * 2),
    value: Number(point[key]),
    date: point.date.slice(5).replace("-", "/")
  }));
  const path = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const labels = coordinates.length === 1 ? coordinates : [coordinates[0], coordinates.at(-1)];
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="近30天${label}曲线">
    <line class="profile-chart-grid" x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}"></line>
    <path class="profile-chart-line" style="stroke:${color}" d="${path}"></path>
    ${coordinates.map(point => `<circle class="profile-chart-dot" style="fill:${color}" cx="${point.x}" cy="${point.y}" r="4"></circle>`).join("")}
    ${labels.map(point => `<text class="profile-chart-value" x="${point.x}" y="${Math.max(14, point.y - 10)}">${formatValue(point.value)}</text><text class="profile-chart-date" x="${point.x}" y="${height - 8}">${point.date}</text>`).join("")}
  </svg>`;
}

function renderProfileTrends() {
  if (!hasCompletedProfile()) return;
  const summary = window.HealthTrendManager.summarize(state.logs, state.profile);
  setText("profile-trend-weight-start", summary.startWeight == null ? "—" : formatValue(summary.startWeight));
  setText("profile-trend-weight-end", summary.endWeight == null ? "—" : formatValue(summary.endWeight));
  setText("profile-trend-weight-change", trendChangeCopy(summary.weightChange, " kg"));
  setText("profile-trend-bmi-start", summary.startBmi == null ? "—" : formatValue(summary.startBmi));
  setText("profile-trend-bmi-end", summary.endBmi == null ? "—" : formatValue(summary.endBmi));
  setText("profile-trend-bmi-change", trendChangeCopy(summary.bmiChange));
  setText("profile-trend-streak", summary.streak);
  setText("profile-trend-recorded-days", summary.recordedDays);
  renderProfileChart("profile-weight-chart", summary.points, "weight", "#d77a82", "体重");
  renderProfileChart("profile-bmi-chart", summary.points, "bmi", "#8daa83", "BMI");
}

function renderAvatar(imageId, fallbackId, avatar) {
  const image = document.getElementById(imageId);
  const fallback = document.getElementById(fallbackId);
  const hasAvatar = Boolean(avatar);
  if (image) {
    if (hasAvatar) image.src = avatar;
    else image.removeAttribute("src");
    image.hidden = !hasAvatar;
  }
  if (fallback) fallback.hidden = hasAvatar;
}

function formatCheckInDate(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
  if (!match) return "—";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function renderCheckInSummary() {
  const summary = window.CheckInSystem.getSummary(state.checkIns);
  setText("check-in-continuous", summary.continuousDays);
  setText("home-check-in-continuous", summary.continuousDays);
  setText("check-in-total", summary.totalDays);
  setText("check-in-first-date", summary.firstDate ? formatCheckInDate(summary.firstDate) : "—");
  setText(
    "check-in-companion-copy",
    summary.totalDays ? `🧸 已陪伴你坚持 ${summary.totalDays} 天` : "还没有打卡记录"
  );

  const history = document.querySelector("#check-in-history-list");
  if (!history) return;
  history.replaceChildren();
  if (!summary.history.length) {
    const empty = document.createElement("p");
    empty.textContent = "完成第一次打卡后，记录会出现在这里。";
    history.append(empty);
    return;
  }
  for (const record of summary.history) {
    const item = document.createElement("div");
    item.className = "check-in-history-item";
    const date = document.createElement("span");
    date.textContent = formatCheckInDate(record.date);
    const streak = document.createElement("strong");
    streak.textContent = `连续 ${record.continuousDays} 天`;
    item.append(date, streak);
    history.append(item);
  }
}

function openDailyCheckInIfNeeded() {
  if (!hasCompletedProfile() || window.CheckInSystem.hasCheckedToday(state.checkIns)) return;
  const dialog = document.querySelector("#check-in-dialog");
  if (dialog && !dialog.open) dialog.showModal();
}

function completeDailyCheckIn() {
  state.checkIns = window.CheckInSystem.checkIn(state.checkIns);
  const summary = window.CheckInSystem.getSummary(state.checkIns);
  saveState("今日打卡已保存");
  renderCheckInSummary();
  document.querySelector("#check-in-dialog")?.close();
  showToast(`打卡成功，已连续坚持 ${summary.continuousDays} 天`);
}

function renderHealthScore() {
  const result = window.HealthScoreManager.calculate({ logs: state.logs, settings: state.settings });
  setText("health-score-total", result.total);
  setText("health-score-diet", result.diet);
  setText("health-score-exercise", result.exercise);
  setText("health-score-water", result.hydration);
  setText("health-score-advice", result.advice);
  setBar("health-score-diet-bar", result.diet / 100);
  setBar("health-score-exercise-bar", result.exercise / 100);
  setBar("health-score-water-bar", result.hydration / 100);
  const ring = document.querySelector("#health-score-ring");
  if (ring) ring.style.setProperty("--health-score", `${result.total * 3.6}deg`);
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
  renderCheckInSummary();
  renderProfileTrends();
  renderNutrition();
  renderHealthScore();
  renderExercise();
  renderNutritionHistory();
  renderHomeMode();
}

function renderActionHome() {
  if (!hasCompletedProfile()) return;
  const profile = window.UserProfileManager.normalize(state.profile);
  const energy = sumToday("meal");
  const activity = todayActivityMinutes();
  const foodPercent = Math.min(100, Math.round(energy / Math.max(Number(state.settings.energyTarget), 1) * 100));
  const exercisePercent = Math.min(100, Math.round(activity / Math.max(Number(state.settings.activityTarget), 1) * 100));
  const overall = Math.round((foodPercent + exercisePercent) / 2);

  setText("home-action-name", profile.name);
  setText("home-action-current-weight", formatValue(profile.currentWeight));
  setText("home-action-goal-weight", formatValue(profile.goalWeight));
  setText("home-action-distance", formatValue(Math.abs(Number(profile.currentWeight) - Number(profile.goalWeight))));
  setText("home-daily-overall", `${overall}%`);
  setText("home-food-progress-copy", `${foodPercent}%`);
  setText("home-exercise-progress-copy", `${exercisePercent}%`);
  setBar("home-food-progress-bar", foodPercent / 100);
  setBar("home-exercise-progress-bar", exercisePercent / 100);

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 6);
  const latestByDay = new Map();
  state.logs.filter(log => log.type === "weight" && new Date(log.at) >= cutoff)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
    .forEach(log => latestByDay.set(dateInputValue(log.at), Number(log.value)));
  const weights = [...latestByDay.values()].filter(Number.isFinite);
  if (!weights.length) weights.push(Number(profile.currentWeight));
  const start = weights[0];
  const end = weights.at(-1);
  const change = end - start;
  setText("home-trend-start", formatValue(start));
  setText("home-trend-end", formatValue(end));
  setText("home-trend-arrow", change > 0 ? "↑" : change < 0 ? "↓" : "→");
  setText("home-trend-change", weights.length < 2 ? "记录两次后显示变化" : `近 7 天${change > 0 ? "上升" : change < 0 ? "下降" : "保持"} ${formatValue(Math.abs(change))} kg`);
  const chart = document.querySelector("#home-mini-weight-chart");
  if (chart) {
    const points = weights.length === 1 ? [weights[0], weights[0]] : weights;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = Math.max(max - min, 0.5);
    const coords = points.map((value, index) => `${8 + index * 124 / Math.max(points.length - 1, 1)},${58 - (value - min) / span * 42}`).join(" ");
    chart.innerHTML = `<svg viewBox="0 0 140 66" role="img" aria-label="近 7 天体重折线图"><path d="M8 58H132" class="mini-chart-baseline"></path><polyline points="${coords}" class="mini-chart-line"></polyline></svg>`;
  }

  const protein = state.logs.filter(log => log.type === "meal" && isToday(log.at)).reduce((sum, log) => sum + Number(log.protein || 0), 0);
  const remainingMinutes = Math.max(0, Math.round(Number(state.settings.activityTarget) - activity));
  const advice = [];
  if (!energy) advice.push(["先记录今天的第一餐", "记录后会自动更新热量与营养进度。", "meal"]);
  else if (protein < 45) advice.push(["蛋白质摄入偏少", "下一餐可增加鸡蛋、牛奶或豆制品。", "meal"]);
  else advice.push(["饮食记录进行得不错", "继续按饥饿感安排下一餐。", "meal"]);
  if (remainingMinutes > 0) advice.push(["今天还可以动一动", `建议散步 ${Math.min(remainingMinutes, 20)} 分钟，从轻松完成开始。`, "activity"]);
  else advice.push(["今日运动目标已完成", "做一组轻柔拉伸，帮助身体恢复。", "activity"]);
  const adviceNode = document.querySelector("#home-action-advice");
  if (adviceNode) adviceNode.innerHTML = advice.map(([title, copy, type]) => `<button type="button" data-log="${type}"><span></span><div><strong>${title}</strong><small>${copy}</small></div><b>＋</b></button>`).join("");
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
      <div class="meal-photo">${log.image ? `<img src="${log.image}" alt="${escapeHtml(log.mealType || "饮食")}图片">` : `<span aria-hidden="true">${escapeHtml(log.recipeEmoji || "🍓")}</span>`}</div>
      <div class="meal-card-copy">
        <span>${escapeHtml(log.mealType || "饮食")}</span>
        <strong>${escapeHtml(log.foodName || log.note || "已记录一餐")}</strong>
        <small>${Math.round(Number(log.value) || 0)} kcal · ${formatValue(log.weight || 0)}g · ${formatMealDate(log)}</small>
        <div class="meal-macros"><span>蛋白 ${formatValue(log.protein || 0)}g</span><span>碳水 ${formatValue(log.carbs || 0)}g</span><span>脂肪 ${formatValue(log.fat || 0)}g</span></div>
        ${log.note && log.foodName ? `<p>${escapeHtml(log.note)}</p>` : ""}
        <div class="meal-card-actions"><button type="button" data-edit-meal="${log.id}">编辑</button><button type="button" data-delete-meal="${log.id}">删除</button></div>
      </div>
    </article>`).join("");
}

function renderNutritionHistory() {
  const container = document.querySelector("#nutrition-history-list");
  if (!container) return;
  const history = state.logs
    .filter(log => log.type === "meal")
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 30);
  if (!history.length) {
    container.innerHTML = '<p class="empty-state">还没有饮食记录。</p>';
    return;
  }
  container.innerHTML = history.map(log => `
    <article><div><span>${escapeHtml(log.mealType || "饮食")} · ${escapeHtml(formatMealDate(log))}</span><strong>${escapeHtml(log.foodName || log.note || "饮食记录")}</strong></div><b>${Math.round(Number(log.value) || 0)} kcal</b><div class="nutrition-history-actions"><button type="button" data-edit-meal="${log.id}">编辑</button><button type="button" data-delete-meal="${log.id}">删除</button></div></article>`).join("");
}

function formatMealDate(log) {
  const date = new Date(log.at);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function renderNutrition() {
  const summary = window.NutritionManager.summary(state.logs, state.settings);
  const consumed = Math.round(summary.consumed.calories);
  const remaining = Math.round(summary.remaining);
  const percentage = Math.max(0, summary.percentage);
  for (const id of ["nutrition-target", "nutrition-ring-target", "nutrition-page-target"]) setText(id, Math.round(summary.target));
  for (const id of ["nutrition-consumed", "nutrition-ring-consumed", "nutrition-page-consumed"]) setText(id, consumed);
  setText("nutrition-remaining", Math.max(0, remaining));
  setText("nutrition-percentage", `${percentage}%`);
  setText("nutrition-protein", formatValue(summary.consumed.protein));
  setText("nutrition-carbs", formatValue(summary.consumed.carbs));
  setText("nutrition-fat", formatValue(summary.consumed.fat));
  setText("nutrition-page-protein", formatValue(summary.consumed.protein));
  setText("nutrition-page-carbs", formatValue(summary.consumed.carbs));
  setText("nutrition-page-fat", formatValue(summary.consumed.fat));
  setText("nutrition-page-remaining", summary.exceeded ? `今日已超出 ${Math.abs(remaining)} kcal` : `还可摄入 ${remaining} kcal`);
  setText("nutrition-alert", summary.exceeded ? "今日热量已超标，建议选择低热量食物。" : `距离今日目标还可以摄入 ${remaining} kcal。`);
  const ring = document.querySelector("#nutrition-ring-value");
  if (ring) ring.style.strokeDashoffset = String(351.86 * (1 - Math.min(percentage, 100) / 100));
  const pageBar = document.querySelector("#nutrition-page-bar");
  if (pageBar) pageBar.style.width = `${Math.min(percentage, 100)}%`;
  document.querySelector("#nutrition-ring")?.classList.toggle("is-over", summary.exceeded);
  document.querySelector(".nutrition-page-summary")?.classList.toggle("is-over", summary.exceeded);
  renderRecipeRecommendations(summary);
}

function fillNutritionGoal() {
  const form = document.querySelector("#nutrition-goal-form");
  if (!form) return;
  form.elements.healthGoal.value = window.NutritionManager.normalizeGoal(state.settings.healthGoal);
  form.elements.energyTarget.value = String(Math.round(Number(state.settings.energyTarget) || 1850));
  updateGoalRecommendation();
  renderNutritionGoalEditor();
}

function renderNutritionGoalEditor() {
  const configured = Boolean(state.settings.nutritionGoalConfigured);
  const showForm = nutritionGoalEditing || !configured;
  const form = document.querySelector("#nutrition-goal-form");
  const summary = document.querySelector("#nutrition-goal-summary");
  if (form) form.hidden = !showForm;
  if (summary) summary.hidden = showForm;
  setText("nutrition-goal-summary-label", window.NutritionManager.GOAL_LABELS[window.NutritionManager.normalizeGoal(state.settings.healthGoal)]);
  setText("nutrition-goal-summary-calories", Math.round(Number(state.settings.energyTarget) || 1850));
  const cancel = document.querySelector("[data-hide-nutrition-goal]");
  if (cancel) cancel.hidden = !configured;
}

function editNutritionGoal() {
  nutritionGoalEditing = true;
  fillNutritionGoal();
  document.querySelector("#nutrition-goal-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hideNutritionGoal() {
  if (!state.settings.nutritionGoalConfigured) return;
  nutritionGoalEditing = false;
  renderNutritionGoalEditor();
}

function updateGoalRecommendation() {
  const form = document.querySelector("#nutrition-goal-form");
  if (!form) return;
  const goal = window.NutritionManager.normalizeGoal(form.elements.healthGoal.value);
  const recommended = window.NutritionManager.GOAL_DEFAULTS[goal];
  setText("goal-recommendation", `${window.NutritionManager.GOAL_LABELS[goal]}参考值约 ${recommended} kcal；你仍可按实际需要修改。`);
}

function submitNutritionGoal(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.settings.healthGoal = window.NutritionManager.normalizeGoal(data.get("healthGoal"));
  state.settings.energyTarget = Math.max(800, Math.min(5000, Number(data.get("energyTarget")) || 1850));
  state.settings.nutritionGoalConfigured = true;
  nutritionGoalEditing = false;
  saveState("饮食目标已保存");
  fillSettings();
  renderDashboard();
  renderNutritionGoalEditor();
  showToast("饮食目标已更新");
}

function adjustNutritionCalories(amount) {
  const input = document.querySelector("#nutrition-goal-calories");
  if (!input) return;
  input.value = String(Math.max(800, Math.min(5000, Number(input.value || 0) + amount)));
}

function renderRecipeRecommendations(summary = window.NutritionManager.summary(state.logs, state.settings)) {
  const grid = document.querySelector("#recipe-grid");
  if (!grid) return;
  const searchQuery = document.querySelector("#recipe-search-input")?.value.trim() || "";
  let recipes;
  if (recipeDisplayMode === "search" && searchQuery) {
    recipes = window.RecipeRecommendationSystem.search(searchQuery, summary.remaining, summary.healthGoal);
  } else {
    recipeDisplayMode = "random";
    recipes = window.RecipeRecommendationSystem.recommend(summary.remaining, summary.healthGoal, 5);
  }
  if (!recipes.length) {
    grid.innerHTML = '<div class="recipe-empty">没有找到合适的食谱，请减少食材条件或换个关键词。</div>';
    return;
  }
  grid.innerHTML = recipes.map(recipe => `
    <button class="recipe-card" type="button" data-recipe-id="${recipe.id}">
      <span class="recipe-image" aria-hidden="true">${recipe.emoji}</span>
      <span class="recipe-card-copy"><strong>${escapeHtml(recipe.name)}</strong><small>${recipe.calories} kcal</small><span>蛋白质 ${recipe.protein}g · 碳水 ${recipe.carbs}g · 脂肪 ${recipe.fat}g</span><em>${escapeHtml(recipe.principle)}</em></span>
    </button>`).join("");
  grid.scrollTo({ left: 0, behavior: "auto" });
}

function submitRecipeSearch(event) {
  event.preventDefault();
  const query = String(new FormData(event.currentTarget).get("query") || "").trim();
  recipeDisplayMode = query ? "search" : "random";
  renderNutrition();
}

function refreshRecipeRecommendations() {
  recipeDisplayMode = "random";
  const searchInput = document.querySelector("#recipe-search-input");
  if (searchInput) searchInput.value = "";
  renderNutrition();
  showToast("已随机换一批食谱");
}

function advanceRecipeCarousel() {
  const grid = document.querySelector("#recipe-grid");
  if (!grid || recipeAutoplayPaused || document.hidden || !grid.closest(".view")?.classList.contains("is-active")) return;
  const maxScroll = grid.scrollWidth - grid.clientWidth;
  const firstCard = grid.querySelector(".recipe-card");
  if (!firstCard || maxScroll < 4) return;
  const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
  const step = firstCard.getBoundingClientRect().width + gap;
  const next = grid.scrollLeft >= maxScroll - 4 ? 0 : Math.min(grid.scrollLeft + step, maxScroll);
  grid.scrollTo({ left: next, behavior: "smooth" });
}

function initializeRecipeCarousel() {
  const grid = document.querySelector("#recipe-grid");
  if (!grid || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const pause = () => {
    window.clearTimeout(recipeAutoplayResumeTimer);
    recipeAutoplayPaused = true;
  };
  const resume = () => {
    window.clearTimeout(recipeAutoplayResumeTimer);
    recipeAutoplayResumeTimer = window.setTimeout(() => { recipeAutoplayPaused = false; }, 1800);
  };
  grid.dataset.autoplay = "true";
  grid.addEventListener("pointerenter", pause);
  grid.addEventListener("pointerleave", resume);
  grid.addEventListener("pointerdown", pause);
  grid.addEventListener("pointerup", resume);
  grid.addEventListener("pointercancel", resume);
  grid.addEventListener("focusin", pause);
  grid.addEventListener("focusout", resume);
  window.clearInterval(recipeAutoplayTimer);
  recipeAutoplayTimer = window.setInterval(advanceRecipeCarousel, 3200);
}

function advanceExerciseCarousel() {
  const grid = document.querySelector("#exercise-recommendation-grid");
  if (!grid || exerciseAutoplayPaused || document.hidden || !grid.closest(".view")?.classList.contains("is-active")) return;
  const maxScroll = grid.scrollWidth - grid.clientWidth;
  const firstCard = grid.querySelector(".exercise-recommendation-card");
  if (!firstCard || maxScroll < 4) return;
  const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
  const step = firstCard.getBoundingClientRect().width + gap;
  const next = grid.scrollLeft >= maxScroll - 4 ? 0 : Math.min(grid.scrollLeft + step, maxScroll);
  grid.scrollTo({ left: next, behavior: "smooth" });
}

function initializeExerciseCarousel() {
  const grid = document.querySelector("#exercise-recommendation-grid");
  if (!grid || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const pause = () => {
    window.clearTimeout(exerciseAutoplayResumeTimer);
    exerciseAutoplayPaused = true;
  };
  const resume = () => {
    window.clearTimeout(exerciseAutoplayResumeTimer);
    exerciseAutoplayResumeTimer = window.setTimeout(() => { exerciseAutoplayPaused = false; }, 1800);
  };
  grid.dataset.autoplay = "true";
  grid.addEventListener("pointerenter", pause);
  grid.addEventListener("pointerleave", resume);
  grid.addEventListener("pointerdown", pause);
  grid.addEventListener("pointerup", resume);
  grid.addEventListener("pointercancel", resume);
  grid.addEventListener("focusin", pause);
  grid.addEventListener("focusout", resume);
  window.clearInterval(exerciseAutoplayTimer);
  exerciseAutoplayTimer = window.setInterval(advanceExerciseCarousel, 3400);
}

function openRecipeDetail(id) {
  const recipe = window.RecipeRecommendationSystem.getById(id);
  if (!recipe) return;
  const detail = document.querySelector("#recipe-detail");
  detail.innerHTML = `
    <button class="dialog-close" type="button" data-close-dialog aria-label="关闭">×</button>
    <div class="recipe-detail-image" aria-hidden="true">${recipe.emoji}</div>
    <p class="eyebrow">智能推荐食谱</p><h2>${escapeHtml(recipe.name)}</h2>
    <div class="recipe-nutrition"><span><b>${recipe.calories}</b> kcal</span><span>蛋白质 <b>${recipe.protein}g</b></span><span>碳水 <b>${recipe.carbs}g</b></span><span>脂肪 <b>${recipe.fat}g</b></span></div>
    <p class="recipe-principle">搭配特点：${escapeHtml(recipe.principle)}。营养值为估算，请按实际食材调整。</p>
    <h3>制作步骤</h3><ol>${recipe.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
    <button class="primary-button recipe-add-today" type="button" data-add-recipe="${recipe.id}">加入今日饮食</button>`;
  document.querySelector("#recipe-dialog").showModal();
}

function suggestedMealType() {
  const hour = new Date().getHours();
  if (hour < 10) return "早餐";
  if (hour < 15) return "午餐";
  if (hour < 20) return "晚餐";
  return "加餐";
}

function addRecipeToToday(id) {
  const recipe = window.RecipeRecommendationSystem.getById(id);
  if (!recipe) return;
  const now = new Date();
  state.logs.push({
    id: Date.now(), type: "meal", value: recipe.calories, mealType: suggestedMealType(), foodName: recipe.name,
    weight: recipe.weight, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat, image: "", recipeEmoji: recipe.emoji,
    date: window.NutritionManager.dateKey(now), note: "来自智能食谱推荐", sourceRecipeId: recipe.id, at: now.toISOString()
  });
  saveState("食谱已加入今日饮食");
  document.querySelector("#recipe-dialog").close();
  renderDashboard();
  renderTimeline();
  showToast(`“${recipe.name}”已加入今日饮食`);
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
    .filter(log => log.type !== "sleep" && (activeFilter === "all" || log.type === activeFilter))
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

function initializeExercisePage() {
  const tools = document.querySelector(".activity-tools-grid");
  const host = document.querySelector("#exercise-tools-host");
  if (tools && host && tools.parentElement !== host) host.append(tools);
}

function renderExercise() {
  const minutes = todayActivityMinutes();
  const calories = todayBurnCalories();
  const steps = todaySteps();
  const intake = sumToday("meal");
  const targetMinutes = Math.max(10, Number(state.settings.activityTarget) || 30);
  const recommendationInput = {
    intakeCalories: intake,
    energyTarget: state.settings.energyTarget,
    currentWeight: state.profile?.currentWeight,
    goalWeight: state.profile?.goalWeight,
    height: state.profile?.height,
    activityMinutes: minutes,
    steps,
    targetMinutes,
    healthGoal: state.settings.healthGoal
  };
  const recommendations = window.ExerciseRecommendationSystem.recommendMany(recommendationInput, 5);
  const recommendation = recommendations[0];
  const goalLabel = window.NutritionManager.GOAL_LABELS[window.NutritionManager.normalizeGoal(state.settings.healthGoal)];

  setText("exercise-goal-minutes", targetMinutes);
  setText("exercise-goal-minutes-copy", targetMinutes);
  setText("exercise-goal-calories", recommendation.calories);
  setText("exercise-page-minutes", formatValue(minutes));
  setText("exercise-page-calories", Math.round(calories));
  setBar("exercise-goal-progress-bar", minutes / targetMinutes);
  setText("exercise-activity-level", recommendation.activityLevel);
  setText("exercise-ai-intake", Math.round(intake));
  setText("exercise-ai-activity", recommendation.activityLevel);
  setText("exercise-ai-goal", goalLabel);
  const recommendationGrid = document.querySelector("#exercise-recommendation-grid");
  if (recommendationGrid) {
    recommendationGrid.innerHTML = recommendations.map(item => `
      <button class="exercise-recommendation-card" type="button" data-exercise-type="${item.typeId}" data-exercise-minutes="${item.minutes}" data-exercise-name="${escapeHtml(item.name)}">
        <span class="exercise-recommendation-icon" aria-hidden="true">${item.icon}</span>
        <span class="exercise-recommendation-copy"><small>今日推荐</small><strong>${escapeHtml(item.name)}</strong><b>${item.minutes} 分钟 · ${item.calories} kcal</b><em>${escapeHtml(item.reason)}</em></span>
      </button>`).join("");
  }
  setText("exercise-balance-intake", Math.round(intake));
  const balanceAdvice = calories <= 0
    ? `今天已摄入 ${Math.round(intake)} kcal，先完成推荐运动，系统会继续更新热量平衡。`
    : state.settings.healthGoal === "fat_loss" && minutes < targetMinutes
      ? `已消耗 ${Math.round(calories)} kcal；如果继续减脂，建议再完成 ${Math.ceil(targetMinutes - minutes)} 分钟温和运动。`
      : minutes >= targetMinutes
        ? "今天的运动目标已完成，饮食与活动节奏保持得很好。"
        : "今天热量平衡较平稳，继续完成剩余运动目标即可。";
  setText("exercise-balance-advice", balanceAdvice);
  renderExerciseStats();
}

function renderExerciseStats() {
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return { key: dateInputValue(date.toISOString()), label: `${date.getMonth() + 1}/${date.getDate()}`, minutes: 0, calories: 0 };
  });
  const byDate = new Map(dates.map(day => [day.key, day]));
  const records = state.logs
    .filter(log => log.type === "activity" || log.type === "video")
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  records.forEach(log => {
    const day = byDate.get(dateInputValue(log.at));
    if (!day) return;
    day.minutes += Number(log.duration ?? log.value) || 0;
    day.calories += Number(log.calories ?? (log.type === "video" ? log.value : 0)) || 0;
  });
  setText("exercise-week-minutes", formatValue(dates.reduce((sum, day) => sum + day.minutes, 0)));
  setText("exercise-week-calories", Math.round(dates.reduce((sum, day) => sum + day.calories, 0)));
  const maxMinutes = Math.max(1, ...dates.map(day => day.minutes));
  const trend = document.querySelector("#exercise-weekly-trend");
  if (trend) trend.innerHTML = dates.map(day => `<div><i><em style="height:${Math.max(day.minutes ? 12 : 0, day.minutes / maxMinutes * 100)}%"></em></i><b>${formatValue(day.minutes)}</b><span>${day.label}</span></div>`).join("");
  const history = document.querySelector("#exercise-recent-history");
  if (history) history.innerHTML = records.length ? records.slice(0, 12).map(log => `<article><div><strong>${escapeHtml(log.note || "运动")}</strong><span>${escapeHtml(new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(log.at)))}</span></div><b>${formatValue(Number(log.duration ?? log.value) || 0)} 分钟 · ${Math.round(Number(log.calories) || 0)} kcal</b></article>`).join("") : '<p class="empty-state">还没有运动记录。</p>';
}

function openExerciseType(typeId, minutesOverride, nameOverride) {
  const type = window.ExerciseRecommendationSystem.getType(typeId);
  const minutes = Math.max(1, Number(minutesOverride) || type.defaultMinutes);
  openLogDialog("activity");
  const form = document.querySelector("#log-form");
  const typeSelect = form.elements.exerciseType;
  if (typeSelect) {
    typeSelect.value = type.id;
    applyExerciseTypeSelection(typeSelect);
  }
  form.elements.value.value = String(minutes);
  form.elements.note.value = nameOverride || type.name;
  const caloriesInput = form.elements.calories;
  if (caloriesInput) caloriesInput.value = String(window.ExerciseRecommendationSystem.estimateCalories(type, minutes, state.profile?.currentWeight));
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
    const mealType = editingLog?.mealType === "零食" ? "加餐" : (editingLog?.mealType || "早餐");
    fields = `
      <label>日期<input type="date" name="date" value="${mealDate}" required></label>
      <label>类型<select name="mealType" required>${["早餐", "午餐", "晚餐", "加餐"].map(option => `<option ${option === mealType ? "selected" : ""}>${option}</option>`).join("")}</select></label>
      <label class="food-name-field">食物名称<input type="text" name="foodName" maxlength="40" value="${escapeHtml(editingLog?.foodName || "")}" placeholder="例如：草莓酸奶碗" required></label>
      ${fields}
      <label>食物重量（g）<input type="number" name="weight" min="0" max="10000" step="1" value="${escapeHtml(editingLog?.weight || "")}" placeholder="例如 150" required></label>
      <label>蛋白质（g）<input type="number" name="protein" min="0" max="1000" step="0.1" value="${escapeHtml(editingLog?.protein || "")}" placeholder="例如 30" required></label>
      <label>碳水（g）<input type="number" name="carbs" min="0" max="1000" step="0.1" value="${escapeHtml(editingLog?.carbs || "")}" placeholder="例如 45" required></label>
      <label>脂肪（g）<input type="number" name="fat" min="0" max="1000" step="0.1" value="${escapeHtml(editingLog?.fat || "")}" placeholder="例如 12" required></label>
      <label>餐食图片（可选）<input type="file" name="image" accept="image/*"><small class="field-hint">${editingLog?.image ? "已保留原图片；选择新图后会覆盖。" : "图片会压缩后保存在当前浏览器，不会上传。"}</small></label>`;
  }
  if (type === "activity") {
    const savedType = String(editingLog?.exerciseTypeId || "");
    const options = window.ExerciseRecommendationSystem.TYPES.map(item => `<option value="${item.id}" ${savedType === item.id ? "selected" : ""}>${item.icon} ${escapeHtml(item.name)}</option>`).join("");
    const customSelected = editingLog && !window.ExerciseRecommendationSystem.TYPES.some(item => item.id === savedType);
    fields = `<label>运动类型<select name="exerciseType" required><option value="" ${editingLog ? "" : "selected"} disabled>请选择运动类型</option>${options}<option value="custom" ${customSelected ? "selected" : ""}>＋ 自定义运动</option></select></label>${fields}<label>消耗热量（kcal，可选）<input type="number" name="calories" min="0" max="5000" step="1" value="${escapeHtml(editingLog?.calories || "")}" placeholder="例如 120"></label>`;
  }
  document.querySelector("#dynamic-fields").innerHTML = fields;
  const noteInput = form.elements.note;
  const isActivity = type === "activity";
  document.querySelector("#log-note-label").textContent = isActivity ? "运动名称" : "备注（可选）";
  noteInput.placeholder = isActivity ? "例如：羽毛球" : "例如：午餐，七分饱";
  noteInput.required = isActivity;
  noteInput.value = editingLog?.note || "";
  document.querySelector("#log-dialog").showModal();
}

function applyExerciseTypeSelection(select) {
  const form = select?.closest("form");
  if (!form || select.name !== "exerciseType") return;
  const noteInput = form.elements.note;
  if (select.value === "custom") {
    form.elements.value.value = "";
    if (form.elements.calories) form.elements.calories.value = "";
    noteInput.value = "";
    noteInput.focus();
    return;
  }
  const type = window.ExerciseRecommendationSystem.TYPES.find(item => item.id === select.value);
  if (!type) return;
  form.elements.value.value = String(type.defaultMinutes);
  noteInput.value = type.name;
  const caloriesInput = form.elements.calories;
  if (caloriesInput) caloriesInput.value = String(window.ExerciseRecommendationSystem.estimateCalories(type, type.defaultMinutes, state.profile?.currentWeight));
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

function openCaptureSource() {
  pendingCaptureImage = "";
  for (const id of ["capture-camera-input", "capture-album-input"]) {
    const input = document.getElementById(id);
    if (input) input.value = "";
  }
  const dialog = document.querySelector("#capture-source-dialog");
  if (dialog && !dialog.open) dialog.showModal();
}

function renderCaptureKind(kind = "meal") {
  const form = document.querySelector("#capture-detail-form");
  if (!form) return;
  const normalized = kind === "activity" ? "activity" : "meal";
  form.elements.type.value = normalized;
  document.querySelectorAll("[data-capture-kind]").forEach(button => button.classList.toggle("is-active", button.dataset.captureKind === normalized));
  document.querySelector("#capture-detail-fields").innerHTML = normalized === "meal"
    ? `<label>餐次<select name="mealType" required>${["早餐", "午餐", "晚餐", "加餐"].map(option => `<option ${option === suggestedMealType() ? "selected" : ""}>${option}</option>`).join("")}</select></label><label>预计热量（kcal）<input type="number" name="calories" min="0" max="5000" step="1" placeholder="例如 520" required></label>`
    : '<label>运动时间（分钟）<input type="number" name="duration" min="1" max="600" step="1" placeholder="例如 30" required></label><label>消耗热量（kcal）<input type="number" name="calories" min="0" max="5000" step="1" placeholder="例如 120" required></label>';
}

function renderCapturePreview() {
  const preview = document.querySelector("#capture-preview");
  const image = document.querySelector("#capture-preview-image");
  if (!preview || !image) return;
  preview.hidden = !pendingCaptureImage;
  if (pendingCaptureImage) image.src = pendingCaptureImage;
  else image.removeAttribute("src");
}

function openCaptureDetails() {
  document.querySelector("#capture-source-dialog")?.close();
  const form = document.querySelector("#capture-detail-form");
  form.reset();
  renderCaptureKind(captureDefaultKind);
  renderCapturePreview();
  const dialog = document.querySelector("#capture-detail-dialog");
  if (dialog && !dialog.open) dialog.showModal();
}

async function handleCaptureFile(file) {
  if (!file?.size) return;
  try {
    pendingCaptureImage = await resizeMealImage(file);
    openCaptureDetails();
  } catch {
    pendingCaptureImage = "";
    showToast("图片读取失败，请换一张再试");
  }
}

function submitCaptureDetails(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const type = data.get("type") === "activity" ? "activity" : "meal";
  const description = String(data.get("description") || "").trim();
  const calories = Math.max(0, Number(data.get("calories")) || 0);
  const now = new Date();
  if (type === "meal") {
    state.logs.push({ id: Date.now(), type, value: calories, mealType: String(data.get("mealType") || suggestedMealType()), foodName: description, weight: 0, protein: 0, carbs: 0, fat: 0, image: pendingCaptureImage, date: window.NutritionManager.dateKey(now), note: "相机快速记录", at: now.toISOString() });
  } else {
    const duration = Math.max(1, Number(data.get("duration")) || 1);
    state.logs.push({ id: Date.now(), type, value: duration, duration, calories, image: pendingCaptureImage, note: description, at: now.toISOString() });
    if (state.familySystem.family && state.familySystem.currentMemberId) state.familySystem.family = window.FamilyHealthSystem.sharePersonalLogs(state.familySystem.family, state.familySystem.currentMemberId, state.logs);
  }
  pendingCaptureImage = "";
  saveState("快速记录已保存");
  document.querySelector("#capture-detail-dialog")?.close();
  renderDashboard();
  renderTimeline();
  renderInsights();
  showToast(type === "meal" ? "饮食与照片已保存" : state.familySystem.family ? "运动记录已保存并同步到家庭" : "运动记录已保存");
}

async function recognizeAiFood(file) {
  if (!file?.size) return;
  try {
    const image = await resizeMealImage(file);
    pendingAiFood = { ...window.AIFoodRecognition.recognize(file), image };
    document.querySelector("#ai-food-preview-image").src = image;
    setText("ai-food-detected", pendingAiFood.foods.join("、"));
    setText("ai-food-calories", pendingAiFood.calories);
    setText("ai-food-protein", pendingAiFood.protein);
    setText("ai-food-carbs", pendingAiFood.carbs);
    setText("ai-food-fat", pendingAiFood.fat);
    document.querySelector("#ai-food-result").hidden = false;
    showToast("模拟识别完成，请确认食物信息");
  } catch {
    pendingAiFood = null;
    document.querySelector("#ai-food-result").hidden = true;
    showToast("图片读取失败，请换一张再试");
  }
}

function confirmAiFood() {
  if (!pendingAiFood) return;
  const now = new Date();
  state.logs.push({
    id: Date.now(),
    type: "meal",
    value: pendingAiFood.calories,
    mealType: suggestedMealType(),
    foodName: pendingAiFood.name,
    foods: pendingAiFood.foods,
    image: pendingAiFood.image,
    weight: pendingAiFood.weight,
    protein: pendingAiFood.protein,
    carbs: pendingAiFood.carbs,
    fat: pendingAiFood.fat,
    date: window.NutritionManager.dateKey(now),
    note: "来自模拟AI饮食识别，请自行核对",
    aiSimulated: true,
    at: now.toISOString()
  });
  pendingAiFood = null;
  document.querySelector("#ai-food-result").hidden = true;
  document.querySelector("#ai-food-image").value = "";
  saveState("模拟识别餐食已加入今日饮食");
  renderDashboard();
  renderTimeline();
  showToast("已加入今日饮食，热量与营养已更新");
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
    log.weight = Math.max(0, Number(form.get("weight")) || 0);
    log.protein = Math.max(0, Number(form.get("protein")) || 0);
    log.carbs = Math.max(0, Number(form.get("carbs")) || 0);
    log.fat = Math.max(0, Number(form.get("fat")) || 0);
    log.date = String(form.get("date") || dateInputValue(log.at));
    log.at = new Date(`${log.date}T12:00:00`).toISOString();
    log.image = image || existing?.image || "";
    log.recipeEmoji = existing?.recipeEmoji || "";
  }
  if (type === "activity") {
    log.calories = Math.max(0, Number(form.get("calories")) || 0);
    log.exerciseTypeId = String(form.get("exerciseType") || "custom");
  }
  if (existing) Object.assign(existing, log, { id: existing.id });
  else state.logs.push(log);
  if (type === "activity" && state.familySystem.family && state.familySystem.currentMemberId) {
    state.familySystem.family = window.FamilyHealthSystem.sharePersonalLogs(state.familySystem.family, state.familySystem.currentMemberId, state.logs);
  }
  if (type === "weight") {
    state.settings.currentWeight = value;
    if (state.profile) state.profile.currentWeight = value;
  }
  saveState("刚刚保存");
  document.querySelector("#log-dialog").close();
  renderDashboard();
  renderTimeline();
  renderInsights();
  showToast(existing ? "饮食记录已更新" : type === "activity" && state.familySystem.family ? "运动记录已保存并同步到家庭" : `${logConfig[type].name}记录已保存`);
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
  if (!form) return;
  if (state.profile) {
    for (const key of ["name", "signature", "currentWeight", "goalWeight", "height"]) {
      if (form.elements[key]) form.elements[key].value = state.profile[key] ?? "";
    }
  }
  Object.entries(state.settings).forEach(([key, value]) => {
    if (form.elements[key] && value !== null && !["currentWeight", "goalWeight", "height"].includes(key)) form.elements[key].value = value;
  });
  if (form.elements.avatar) form.elements.avatar.value = "";
  if (form.elements.removeAvatar) form.elements.removeAvatar.checked = false;
  renderAvatar("settings-avatar-preview-image", "settings-avatar-preview-fallback", state.profile?.avatar || "");
  renderSettingsBMI();
  renderProfileFamilyInfo(state.familySystem?.family || null);
}

function renderSettingsBMI() {
  const form = document.querySelector("#settings-form");
  if (!form) return;
  const bmi = window.BMIManager.getResult(form.elements.currentWeight?.value, form.elements.height?.value);
  setText("settings-bmi-value", bmi.value ?? "—");
  setText("settings-bmi-status", bmi.label);
}

function runtimeLabel() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
  if (isIOS && standalone) return "iOS Web App";
  if (isIOS) return "iOS Safari";
  return standalone ? "Web App" : "Web 浏览器";
}

function openSettingsDrawer() {
  fillSettings();
  const dialog = document.querySelector("#profile-settings-dialog");
  if (dialog && !dialog.open) dialog.showModal();
}

function initializeSettingsDrawer() {
  const dialog = document.querySelector("#profile-settings-dialog");
  if (dialog && dialog.parentElement !== document.body) document.body.append(dialog);
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
  let avatar = window.UserProfileManager.EMPTY_AVATAR;
  const avatarFile = data.get("avatar");
  try {
    if (avatarFile?.size) avatar = await resizeAvatarImage(avatarFile);
  } catch {
    showToast("头像读取失败，请重新选择");
    return;
  }
  state.profile = window.UserProfileManager.update(null, {
    avatar,
    name: String(data.get("name") || "").trim(),
    signature: String(data.get("signature") || "").trim(),
    currentWeight,
    goalWeight,
    height: Number(data.get("height"))
  });
  Object.assign(state.settings, { currentWeight, goalWeight, height: state.profile.height });
  saveState("资料已保存");
  document.querySelector("#onboarding-dialog").close();
  fillSettings();
  renderDashboard();
  renderTimeline();
  renderInsights();
  showToast(`欢迎你，${state.profile.name}`);
  openDailyCheckInIfNeeded();
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
  if (data.get("removeAvatar")) {
    avatar = window.UserProfileManager.EMPTY_AVATAR;
  } else if (avatarFile?.size) {
    try {
      avatar = await resizeAvatarImage(avatarFile);
    } catch {
      showToast("头像读取失败，请重新选择");
      return;
    }
  }
  state.profile = window.UserProfileManager.update(state.profile, {
    avatar,
    name: String(data.get("name") || "").trim(),
    signature: String(data.get("signature") || "").trim(),
    currentWeight,
    goalWeight,
    height: Number(data.get("height"))
  });
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
  const currentMember = state.familySystem?.family?.members?.find(member => member.memberId === state.familySystem.currentMemberId);
  if (currentMember) currentMember.avatar = state.profile.avatar;
  if (Number.isFinite(previousWeight) && previousWeight !== currentWeight) {
    const now = Date.now();
    const lastWeight = state.logs.filter(log => log.type === "weight").sort((a, b) => new Date(b.at) - new Date(a.at))[0];
    if (!lastWeight || Math.abs(Number(lastWeight.value) - previousWeight) > .001) state.logs.push({ id: now - 1, type: "weight", value: previousWeight, note: "修改前体重", at: new Date(now - 1000).toISOString() });
    state.logs.push({ id: now, type: "weight", value: currentWeight, note: "资料更新", at: new Date(now).toISOString() });
  }
  saveState("资料已保存");
  renderDashboard();
  renderTimeline();
  renderInsights();
  renderFamily();
  fillSettings();
  const settingsDialog = document.querySelector("#profile-settings-dialog");
  if (settingsDialog?.open) settingsDialog.close();
  showToast("个人资料已更新");
}

function renderHealthModeSwitch() {
  const hasFamily = Boolean(state.familySystem?.family);
  if (!hasFamily) state.familySystem.mode = "personal";
  const mode = hasFamily && state.familySystem?.mode === "family" ? "family" : "personal";
  const toolbar = document.querySelector(".home-mode-toolbar");
  if (toolbar) toolbar.hidden = !hasFamily;
  document.querySelectorAll("[data-health-mode]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.healthMode === mode);
    button.setAttribute("aria-pressed", String(button.dataset.healthMode === mode));
  });
}

function setHealthMode(mode) {
  if (mode === "family" && !state.familySystem?.family) {
    showToast("请先在设置中心创建或加入家庭");
    return;
  }
  state.familySystem.mode = mode === "family" ? "family" : "personal";
  saveState(state.familySystem.mode === "family" ? "首页已切换到家庭" : "首页已切换到个人");
  renderHealthModeSwitch();
  setView("today");
  renderHomeMode();
}

function familyFeedKey(item) {
  return `${item.memberId}:${item.type}:${item.id || item.sourceId || item.at}`;
}

function updateFamilyNotifications(family) {
  const feed = window.FamilyHealthSystem.activityFeed(family);
  const known = new Set(state.familySystem.knownFeedKeys || []);
  const fresh = known.size ? feed.filter(item => item.memberId !== state.familySystem.currentMemberId && !known.has(familyFeedKey(item))) : [];
  state.familySystem.knownFeedKeys = feed.map(familyFeedKey);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  for (const id of ["family-update-count", "home-family-update-count"]) {
    const badge = document.getElementById(id);
    if (!badge) continue;
    badge.textContent = `${fresh.length} 条新动态`;
    badge.hidden = !fresh.length;
  }
  if (fresh.length) showToast(`家人更新了 ${fresh.length} 条健康动态`);
}

function renderHomeMode() {
  const personal = document.querySelector("#home-personal-dashboard");
  const familyDashboard = document.querySelector("#home-family-dashboard");
  if (!personal || !familyDashboard) return;
  const familyMode = Boolean(state.familySystem?.family) && state.familySystem.mode === "family";
  personal.hidden = familyMode;
  familyDashboard.hidden = !familyMode;
  setText("home-mode-label", familyMode ? "家庭健康" : "个人健康");
  renderHealthModeSwitch();
  if (document.querySelector("#view-today")?.classList.contains("is-active")) setText("view-title", familyMode ? "家庭健康首页" : greetingTitle());
  if (!familyMode) return;
  renderFamily();
}

function initializeFamilyHome() {
  const source = document.querySelector("#view-family");
  const host = document.querySelector("#family-home-host");
  if (!source || !host) return;
  [...source.children].forEach(child => host.append(child));
  source.remove();
}

function familyAvatarMarkup(member) {
  return member.avatar
    ? `<img src="${escapeHtml(member.avatar)}" alt="${escapeHtml(member.nickname)}的头像">`
    : '<span class="blank-avatar-icon" aria-hidden="true"></span>';
}

function renderFamilyHeaderMembers(family) {
  const container = document.querySelector("#family-header-members");
  if (!container) return;
  container.hidden = !family?.members?.length;
  if (container.hidden) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = family.members.map(member => `
    <div class="family-header-member-chip">
      <div class="family-member-avatar">${familyAvatarMarkup(member)}</div>
      <strong>${escapeHtml(member.nickname)}</strong>
    </div>`).join("");
}

function renderProfileFamilyInfo(family) {
  const card = document.querySelector("#profile-family-info");
  if (!card) return;
  card.hidden = !family;
  if (!family) return;
  setText("profile-family-name", family.familyName);
  setText("family-invite-code", family.inviteCode);
  const currentMember = family.members.find(member => member.memberId === state.familySystem.currentMemberId);
  const familyNameInput = document.querySelector("#family-nickname-form [name='familyName']");
  const nicknameInput = document.querySelector("#family-nickname-form [name='nickname']");
  if (familyNameInput && document.activeElement !== familyNameInput) familyNameInput.value = family.familyName;
  if (nicknameInput && document.activeElement !== nicknameInput) nicknameInput.value = currentMember?.nickname || "";
}

function renderFamilyMembers(family, container) {
  if (!container) return;
  container.innerHTML = family.members.map(member => {
    const snapshot = window.FamilyHealthSystem.healthSnapshot(member);
    return `
    <article class="family-member-card">
      <div class="family-member-heading"><div class="family-member-avatar">${familyAvatarMarkup(member)}</div><div><strong>${escapeHtml(member.nickname)}</strong><p>今日健康完成度</p></div><b>${snapshot.healthScore}%</b></div>
      <div class="family-health-metrics">
        <div><span>饮食 <b>${snapshot.foodCompleted ? "已完成" : "未完成"}</b></span><i><em style="width:${snapshot.foodScore}%"></em></i></div>
        <div><span>运动 <b>${formatValue(snapshot.exerciseMinutes)} 分钟</b></span><i><em style="width:${snapshot.exerciseScore}%"></em></i></div>
      </div>
    </article>`;
  }).join("");
}

function familyFeedTime(iso) {
  const date = new Date(iso);
  const time = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(date);
  return isToday(iso) ? `今天 ${time}` : new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function familyFeedDetails(item) {
  if (item.type === "food") return {
    label: `${item.mealType || "饮食"}记录`,
    title: Array.isArray(item.foods) ? item.foods.join(" · ") : (item.name || "饮食记录"),
    meta: `预计热量 ${Math.round(Number(item.calories) || 0)} kcal`
  };
  return { label: "运动记录", title: `完成${item.name || "运动"} ${formatValue(Number(item.duration) || 0)} 分钟`, meta: `消耗 ${Math.round(Number(item.calories) || 0)} kcal` };
}

function renderFamilyFeed(family, container) {
  if (!container) return;
  const feed = window.FamilyHealthSystem.activityFeed(family);
  if (!feed.length) {
    container.innerHTML = '<p class="family-empty">还没有家庭动态，先分享一条健康记录吧 🍓</p>';
    return;
  }
  container.innerHTML = feed.map(item => {
    const detail = familyFeedDetails(item);
    return `
    <article class="family-feed-item">
      <header><div class="family-member-avatar">${familyAvatarMarkup(item)}</div><div><strong>${escapeHtml(item.nickname)}</strong><time>${escapeHtml(familyFeedTime(item.at))}</time></div><span>${escapeHtml(detail.label)}</span></header>
      ${item.image ? `<img class="family-feed-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name || detail.label)}">` : ""}
      <div class="family-feed-copy"><p>${escapeHtml(detail.title)}</p><b>${escapeHtml(detail.meta)}</b></div>
    </article>`;
  }).join("");
}

function renderFamily() {
  renderHealthModeSwitch();
  const family = window.FamilyHealthSystem.updateHealthScores(state.familySystem?.family);
  const setup = document.querySelector("#family-setup");
  const workspace = document.querySelector("#family-workspace");
  const demo = document.querySelector("#family-demo");
  if (!family) {
    state.familySystem.mode = "personal";
    setText("family-name", "创建或加入家庭");
    renderFamilyHeaderMembers(null);
    renderProfileFamilyInfo(null);
    setup.hidden = false;
    workspace.hidden = true;
    demo.hidden = true;
    renderHealthModeSwitch();
    renderHomeMode();
    return;
  }

  state.familySystem.family = family;
  setup.hidden = true;
  workspace.hidden = false;
  demo.hidden = true;
  setText("family-name", family.familyName);
  setText("family-member-count", `${family.members.length} 人`);
  renderFamilyHeaderMembers(family);
  renderProfileFamilyInfo(family);
  renderFamilyMembers(family, document.querySelector("#family-member-list"));
  renderFamilyFeed(family, document.querySelector("#family-feed"));
  updateFamilyNotifications(family);
  renderHealthModeSwitch();
}

function submitCreateFamily(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const result = window.FamilyHealthSystem.createFamily(state.profile, data.get("familyName"), data.get("nickname"));
  state.familySystem = { mode: "family", ...result };
  saveState("家庭健康空间已创建");
  event.currentTarget.reset();
  renderFamily();
  renderHomeMode();
  document.querySelector("#profile-settings-dialog")?.close();
  showToast(`家庭已创建，邀请码 ${result.family.inviteCode}`);
}

function submitJoinFamily(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const result = window.FamilyHealthSystem.joinFamily(state.familySystem.family, data.get("inviteCode"), state.profile, data.get("nickname"));
  state.familySystem = { mode: "family", ...result };
  saveState("已加入本机模拟家庭");
  event.currentTarget.reset();
  renderFamily();
  renderHomeMode();
  document.querySelector("#profile-settings-dialog")?.close();
  showToast("已加入本机模拟家庭空间");
}

function submitFamilyNickname(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.familySystem.family = window.FamilyHealthSystem.updateFamilyInfo(
    state.familySystem.family,
    state.familySystem.currentMemberId,
    data.get("familyName"),
    data.get("nickname")
  );
  saveState("家庭信息已更新");
  renderFamily();
  showToast("家庭名称和昵称已同步更新");
}

async function copyFamilyInviteCode() {
  const code = String(state.familySystem.family?.inviteCode || "").trim();
  if (!code) return;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(code);
    else {
      const input = document.createElement("textarea");
      input.value = code;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    showToast(`邀请码 ${code} 已复制`);
  } catch {
    showToast(`邀请码：${code}`);
  }
}

function sharePersonalHealth() {
  if (!state.familySystem.family) return;
  const before = window.FamilyHealthSystem.activityFeed(state.familySystem.family).length;
  state.familySystem.family = window.FamilyHealthSystem.sharePersonalLogs(state.familySystem.family, state.familySystem.currentMemberId, state.logs);
  const after = window.FamilyHealthSystem.activityFeed(state.familySystem.family).length;
  saveState("今日健康数据已分享到家庭");
  renderFamily();
  showToast(after > before ? `已分享 ${after - before} 条今日记录` : "今天的记录已经同步过了");
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

function backupFileName() {
  const now = new Date();
  const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  return `轻衡健康备份-${date}.json`;
}

function exportAppData() {
  const payload = {
    format: BACKUP_FORMAT,
    schemaVersion: 1,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: state
  };
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFileName();
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast("数据备份已导出");
}

function isImportableState(value) {
  return Boolean(value && typeof value === "object" && value.settings && typeof value.settings === "object" && Array.isArray(value.tasks) && Array.isArray(value.logs));
}

async function importAppData(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const imported = parsed?.format === BACKUP_FORMAT ? parsed.data : parsed;
    if (!isImportableState(imported)) throw new Error("invalid backup");
    if (!window.confirm("导入会覆盖当前手机里的轻衡数据，确定继续吗？")) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
    showToast("导入成功，正在重新载入");
    setTimeout(() => location.reload(), 600);
  } catch {
    showToast("导入失败，请选择轻衡导出的备份文件");
  } finally {
    const input = document.querySelector("#data-import-file");
    if (input) input.value = "";
  }
}

async function checkForAppUpdate(button) {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    showToast("当前预览环境不支持自动检查更新");
    return;
  }
  if (button) button.disabled = true;
  showToast("正在检查更新…");
  try {
    const registration = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
    await registration.update();
    sessionStorage.setItem(UPDATE_FEEDBACK_KEY, `已完成更新检查 · 当前版本 ${APP_VERSION}`);
    setTimeout(() => location.reload(), 500);
  } catch {
    if (button) button.disabled = false;
    showToast("检查失败，请确认网络后重试");
  }
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
  const cameraButton = event.target.closest("[data-open-camera]");
  const captureSourceButton = event.target.closest("[data-capture-source]");
  const captureKindButton = event.target.closest("[data-capture-kind]");
  const removeCaptureImageButton = event.target.closest("[data-remove-capture-image]");
  const profileButton = event.target.closest("[data-open-profile]");
  const settingsButton = event.target.closest("[data-open-settings]");
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
  const checkInButton = event.target.closest("[data-check-in]");
  const calorieAdjustButton = event.target.closest("[data-calorie-adjust]");
  const recipeButton = event.target.closest("[data-recipe-id]");
  const addRecipeButton = event.target.closest("[data-add-recipe]");
  const refreshRecipesButton = event.target.closest("[data-refresh-recipes]");
  const healthModeButton = event.target.closest("[data-health-mode]");
  const sharePersonalButton = event.target.closest("[data-share-personal-health]");
  const confirmAiFoodButton = event.target.closest("[data-confirm-ai-food]");
  const editNutritionGoalButton = event.target.closest("[data-edit-nutrition-goal]");
  const hideNutritionGoalButton = event.target.closest("[data-hide-nutrition-goal]");
  const exerciseTypeButton = event.target.closest("[data-exercise-type]");
  const copyFamilyCodeButton = event.target.closest("[data-copy-family-code]");
  const checkUpdateButton = event.target.closest("[data-check-update]");
  const exportDataButton = event.target.closest("[data-export-data]");
  const importDataButton = event.target.closest("[data-import-data]");
  const backupDataButton = event.target.closest("[data-backup-data]");

  if (event.target === document.querySelector("#profile-settings-dialog")) {
    event.target.close();
    return;
  }

  if (viewButton) setView(viewButton.dataset.view);
  if (viewLink) setView(viewLink.dataset.viewLink);
  if (logButton) openLogDialog(logButton.dataset.log);
  if (cameraButton) openCaptureSource();
  if (captureSourceButton) {
    const source = captureSourceButton.dataset.captureSource;
    if (source === "blank") openCaptureDetails();
    if (source === "camera") document.querySelector("#capture-camera-input")?.click();
    if (source === "album") document.querySelector("#capture-album-input")?.click();
  }
  if (captureKindButton) renderCaptureKind(captureKindButton.dataset.captureKind);
  if (removeCaptureImageButton) {
    pendingCaptureImage = "";
    renderCapturePreview();
  }
  if (closeDialogButton) closeDialogButton.closest("dialog")?.close();
  if (addStepsButton) addSteps(Number(addStepsButton.dataset.stepsAdd));
  if (saveStepsButton) saveTodaySteps();
  if (editMealButton) openLogDialog("meal", editMealButton.dataset.editMeal);
  if (deleteMealButton) deleteMealRecord(deleteMealButton.dataset.deleteMeal);
  if (trendToggleButton) toggleWeightChart(trendToggleButton);
  if (editTasksButton) openTaskEditor();
  if (addTaskRowButton) addTaskEditorRow();
  if (removeTaskRowButton) removeTaskEditorRow(removeTaskRowButton);
  if (checkInButton) completeDailyCheckIn();
  if (calorieAdjustButton) adjustNutritionCalories(Number(calorieAdjustButton.dataset.calorieAdjust));
  if (recipeButton) openRecipeDetail(recipeButton.dataset.recipeId);
  if (addRecipeButton) addRecipeToToday(addRecipeButton.dataset.addRecipe);
  if (refreshRecipesButton) refreshRecipeRecommendations();
  if (healthModeButton) setHealthMode(healthModeButton.dataset.healthMode);
  if (sharePersonalButton) sharePersonalHealth();
  if (confirmAiFoodButton) confirmAiFood();
  if (editNutritionGoalButton) editNutritionGoal();
  if (hideNutritionGoalButton) hideNutritionGoal();
  if (exerciseTypeButton) openExerciseType(exerciseTypeButton.dataset.exerciseType, exerciseTypeButton.dataset.exerciseMinutes, exerciseTypeButton.dataset.exerciseName);
  if (copyFamilyCodeButton) copyFamilyInviteCode();
  if (checkUpdateButton) checkForAppUpdate(checkUpdateButton);
  if (exportDataButton) exportAppData();
  if (backupDataButton) exportAppData();
  if (importDataButton) document.querySelector("#data-import-file")?.click();
  if (profileButton) setView("profile");
  if (settingsButton) openSettingsDrawer();
  if (filterButton) {
    activeFilter = filterButton.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(button => button.classList.toggle("is-active", button === filterButton));
    renderTimeline();
  }
});

document.addEventListener("change", event => {
  if (event.target.matches('#log-form select[name="exerciseType"]')) {
    applyExerciseTypeSelection(event.target);
    return;
  }
  if (event.target.matches("#capture-camera-input, #capture-album-input")) {
    handleCaptureFile(event.target.files?.[0]);
    return;
  }
  if (event.target.matches("#data-import-file")) {
    importAppData(event.target.files?.[0]);
    return;
  }
  if (event.target.matches("#ai-food-image")) {
    recognizeAiFood(event.target.files?.[0]);
    return;
  }
  const task = event.target.closest("[data-task]");
  if (!task) return;
  const item = state.tasks.find(entry => entry.id === task.dataset.task);
  if (item) item.done = task.checked;
  saveState("计划已更新");
  renderDashboard();
});

document.querySelector("#settings-form").addEventListener("input", event => {
  if (event.target.matches('[name="currentWeight"], [name="height"]')) renderSettingsBMI();
});

document.querySelector("#log-form").addEventListener("submit", submitLog);
document.querySelector("#capture-detail-form").addEventListener("submit", submitCaptureDetails);
document.querySelector("#task-form").addEventListener("submit", submitTaskEditor);
document.querySelector("#onboarding-form").addEventListener("submit", submitOnboarding);
document.querySelector("#onboarding-dialog").addEventListener("cancel", event => event.preventDefault());
document.querySelector("#check-in-dialog").addEventListener("cancel", event => event.preventDefault());
document.querySelector("#settings-form").addEventListener("submit", submitSettings);
document.querySelector("#nutrition-goal-form").addEventListener("submit", submitNutritionGoal);
document.querySelector("#recipe-search-form").addEventListener("submit", submitRecipeSearch);
document.querySelector("#create-family-form").addEventListener("submit", submitCreateFamily);
document.querySelector("#join-family-form").addEventListener("submit", submitJoinFamily);
document.querySelector("#family-nickname-form").addEventListener("submit", submitFamilyNickname);
document.querySelector("#health-goal").addEventListener("change", event => {
  const goal = window.NutritionManager.normalizeGoal(event.target.value);
  document.querySelector("#nutrition-goal-calories").value = String(window.NutritionManager.GOAL_DEFAULTS[goal]);
  updateGoalRecommendation();
});
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" });
document.querySelector("#today-date").textContent = dateFormatter.format(new Date());
setText("app-version", APP_VERSION);
setText("app-updated-at", APP_UPDATED_AT);
setText("app-runtime", runtimeLabel());
const updateFeedback = sessionStorage.getItem(UPDATE_FEEDBACK_KEY);
if (updateFeedback) {
  sessionStorage.removeItem(UPDATE_FEEDBACK_KEY);
  setTimeout(() => showToast(updateFeedback), 300);
}
initializeSettingsDrawer();
initializeFamilyHome();
initializeExercisePage();
fillSettings();
renderDashboard();
initializeRecipeCarousel();
initializeExerciseCarousel();
renderTimeline();
renderInsights();
fillNutritionGoal();
renderHealthModeSwitch();
renderFamily();
if (!hasCompletedProfile()) document.querySelector("#onboarding-dialog").showModal();
else openDailyCheckInIfNeeded();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      await registration.update();
    } catch {}
  });
}
