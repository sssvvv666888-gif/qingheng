(function createCheckInSystem(global) {
  function toDateKey(input = new Date()) {
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateFromKey(key) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function previousDateKey(key) {
    const date = dateFromKey(key);
    if (!date) return "";
    date.setDate(date.getDate() - 1);
    return toDateKey(date);
  }

  function normalize(records) {
    const byDate = new Map();
    for (const record of Array.isArray(records) ? records : []) {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(record?.date || "")) ? record.date : "";
      if (!date || record?.isChecked === false) continue;
      byDate.set(date, { date, isChecked: true, continuousDays: Math.max(1, Number(record.continuousDays) || 1) });
    }
    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  function hasCheckedToday(records, now = new Date()) {
    const today = toDateKey(now);
    return normalize(records).some(record => record.date === today);
  }

  function checkIn(records, now = new Date()) {
    const normalized = normalize(records);
    const today = toDateKey(now);
    if (!today || normalized.some(record => record.date === today)) return normalized;
    const yesterday = previousDateKey(today);
    const previous = normalized.find(record => record.date === yesterday);
    normalized.push({
      date: today,
      isChecked: true,
      continuousDays: previous ? previous.continuousDays + 1 : 1
    });
    return normalized;
  }

  function getSummary(records, now = new Date()) {
    const normalized = normalize(records);
    const latest = normalized.at(-1);
    const today = toDateKey(now);
    const activeDates = new Set([today, previousDateKey(today)]);
    return {
      firstDate: normalized[0]?.date || "",
      totalDays: normalized.length,
      continuousDays: latest && activeDates.has(latest.date) ? latest.continuousDays : 0,
      checkedToday: Boolean(latest?.date === today),
      history: [...normalized].reverse()
    };
  }

  global.CheckInSystem = Object.freeze({ toDateKey, normalize, hasCheckedToday, checkIn, getSummary });
})(window);
