(function createHealthTrendManager(global) {
  function dateKey(value) {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function summarize(logs = [], profile = {}, now = new Date()) {
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 29);
    const latestWeightByDay = new Map();
    logs
      .filter(log => log.type === "weight" && new Date(log.at) >= cutoff)
      .sort((left, right) => new Date(left.at) - new Date(right.at))
      .forEach(log => latestWeightByDay.set(dateKey(log.at), { date: dateKey(log.at), weight: Number(log.value) }));
    const todayKey = dateKey(now);
    if (Number(profile.currentWeight) > 0 && !latestWeightByDay.has(todayKey)) {
      latestWeightByDay.set(todayKey, { date: todayKey, weight: Number(profile.currentWeight) });
    }
    const height = Number(profile.height);
    const points = [...latestWeightByDay.values()]
      .filter(point => Number.isFinite(point.weight))
      .sort((left, right) => left.date.localeCompare(right.date))
      .map(point => ({ ...point, bmi: global.BMIManager.calculate(point.weight, height) }));
    const first = points[0] || null;
    const last = points.at(-1) || null;
    const recordedDates = new Set(logs.filter(log => new Date(log.at) >= cutoff).map(log => dateKey(log.at)));
    let streak = 0;
    const cursor = new Date(now);
    cursor.setHours(12, 0, 0, 0);
    while (recordedDates.has(dateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      points,
      startWeight: first?.weight ?? null,
      endWeight: last?.weight ?? null,
      weightChange: first && last ? Math.round((last.weight - first.weight) * 10) / 10 : null,
      startBmi: first?.bmi ?? null,
      endBmi: last?.bmi ?? null,
      bmiChange: first?.bmi != null && last?.bmi != null ? Math.round((last.bmi - first.bmi) * 10) / 10 : null,
      streak,
      recordedDays: recordedDates.size
    };
  }

  global.HealthTrendManager = Object.freeze({ dateKey, summarize });
})(window);
