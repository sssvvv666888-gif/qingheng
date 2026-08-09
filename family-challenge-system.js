(function createFamilyChallengeSystem(global) {
  const DEFINITIONS = Object.freeze([
    { id: "exercise-3", title: "一起运动 3 次", target: 3, unit: "次", badge: "活力小熊", emoji: "🏃" },
    { id: "water-7", title: "每天喝水 1500ml", target: 7, unit: "天", badge: "水润草莓", emoji: "💧" },
    { id: "healthy-food-7", title: "连续健康饮食 7 天", target: 7, unit: "天", badge: "均衡餐桌", emoji: "🍓" }
  ]);

  function dateKey(value) {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function currentWeekKey(now = new Date()) {
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    return dateKey(monday);
  }

  function normalize(value, now = new Date()) {
    const weekKey = currentWeekKey(now);
    const valid = value && value.weekKey === weekKey;
    const saved = new Map((valid && Array.isArray(value.items) ? value.items : []).map(item => [item.id, item]));
    return {
      weekKey,
      items: DEFINITIONS.map(definition => ({
        ...definition,
        manualProgress: Math.max(0, Number(saved.get(definition.id)?.manualProgress) || 0),
        progress: 0,
        completed: false,
        contributors: Array.isArray(saved.get(definition.id)?.contributors) ? saved.get(definition.id).contributors : []
      })),
      badges: []
    };
  }

  function withinCurrentWeek(iso, weekKey) {
    const start = new Date(`${weekKey}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const value = new Date(iso);
    return value >= start && value < end;
  }

  function syncFamily(familyValue) {
    if (!familyValue) return null;
    const family = familyValue;
    const challengeState = normalize(family.challenges);
    const exerciseCount = family.members.reduce((sum, member) => sum + member.exerciseRecords.filter(record => withinCurrentWeek(record.at, challengeState.weekKey)).length, 0);
    const healthyDates = new Set();
    family.members.forEach(member => member.foodRecords.filter(record => withinCurrentWeek(record.at, challengeState.weekKey)).forEach(record => healthyDates.add(dateKey(record.at))));
    challengeState.items.forEach(item => {
      const automatic = item.id === "exercise-3" ? exerciseCount : item.id === "healthy-food-7" ? healthyDates.size : 0;
      item.progress = Math.min(item.target, Math.max(item.manualProgress, automatic));
      item.completed = item.progress >= item.target;
    });
    challengeState.badges = challengeState.items.filter(item => item.completed).map(item => ({ id: item.id, name: item.badge, emoji: item.emoji }));
    if (challengeState.items.every(item => item.completed)) challengeState.badges.push({ id: "family-all", name: "全家闪闪发光", emoji: "🏅" });
    family.challenges = challengeState;
    return family;
  }

  function addProgress(familyValue, challengeId, memberId) {
    const family = syncFamily(familyValue);
    const item = family?.challenges.items.find(entry => entry.id === challengeId);
    if (!item || item.completed) return family;
    item.manualProgress = Math.min(item.target, item.manualProgress + 1);
    if (memberId && !item.contributors.includes(memberId)) item.contributors.push(memberId);
    return syncFamily(family);
  }

  global.FamilyChallengeSystem = Object.freeze({ DEFINITIONS, currentWeekKey, normalize, syncFamily, addProgress });
})(window);
