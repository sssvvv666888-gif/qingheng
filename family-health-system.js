(function createFamilyHealthSystem(global) {
  const DEFAULT_PRIVACY = Object.freeze({ shareFood: true, shareExercise: true, shareSleep: false });

  function makeId(prefix) {
    const value = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return `${prefix}-${value}`;
  }

  function inviteCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");
  }

  function normalizeRecordList(value) {
    return Array.isArray(value) ? value.filter(record => record && typeof record === "object") : [];
  }

  function normalizeMember(member = {}) {
    return {
      memberId: String(member.memberId || makeId("member")),
      nickname: String(member.nickname || "家庭成员").trim(),
      avatar: typeof member.avatar === "string" ? member.avatar : "",
      foodRecords: normalizeRecordList(member.foodRecords),
      exerciseRecords: normalizeRecordList(member.exerciseRecords),
      sleepRecords: normalizeRecordList(member.sleepRecords),
      healthScore: Math.max(0, Math.min(100, Number(member.healthScore) || 0)),
      privacy: { ...DEFAULT_PRIVACY, ...(member.privacy || {}) },
      joinedAt: member.joinedAt || new Date().toISOString()
    };
  }

  function normalizeFamily(family) {
    if (!family || typeof family !== "object") return null;
    return {
      familyId: String(family.familyId || makeId("family")),
      familyName: String(family.familyName || "我的健康家庭").trim(),
      inviteCode: String(family.inviteCode || inviteCode()).trim().toUpperCase(),
      members: (Array.isArray(family.members) ? family.members : []).map(normalizeMember),
      createdAt: family.createdAt || new Date().toISOString(),
      localOnly: true
    };
  }

  function memberFromProfile(profile, nickname) {
    return normalizeMember({ nickname: nickname || profile?.name || "我", avatar: profile?.avatar || "" });
  }

  function createFamily(profile, familyName, nickname) {
    const member = memberFromProfile(profile, nickname);
    const family = normalizeFamily({ familyName, inviteCode: inviteCode(), members: [member] });
    return { family, currentMemberId: member.memberId };
  }

  function sampleTime(hoursAgo) {
    const date = new Date();
    date.setHours(date.getHours() - hoursAgo);
    return date.toISOString();
  }

  function demoFamily(profile) {
    return updateHealthScores(normalizeFamily({
      familyId: "family-demo",
      familyName: "草莓健康之家（示例）",
      inviteCode: "BERRY8",
      members: [
        { memberId: "demo-me", nickname: profile?.name || "小明", avatar: profile?.avatar || "", foodRecords: [{ id: "demo-food-me", at: sampleTime(5), mealType: "午餐", name: "鸡胸肉健康便当", foods: ["鸡胸肉", "糙米", "西兰花"], calories: 520, image: "" }], exerciseRecords: [{ id: "demo-run", at: sampleTime(1), name: "跑步", duration: 30, calories: 250 }], sleepRecords: [{ id: "demo-sleep-me", at: sampleTime(8), hours: 7.2, quality: "精神不错" }] },
        { memberId: "demo-mom", nickname: "妈妈", foodRecords: [{ id: "demo-food-mom", at: sampleTime(6), mealType: "午餐", name: "红烧鱼、青菜、米饭", foods: ["红烧鱼", "青菜", "米饭"], calories: 560, image: "" }], exerciseRecords: [{ id: "demo-walk", at: sampleTime(2), name: "散步", duration: 40, calories: 150 }], sleepRecords: [{ id: "demo-sleep-mom", at: sampleTime(9), hours: 8, quality: "睡得很好" }] },
        { memberId: "demo-dad", nickname: "爸爸", foodRecords: [{ id: "demo-food-dad", at: sampleTime(4), mealType: "早餐", name: "燕麦牛奶", foods: ["燕麦", "牛奶"], calories: 360, image: "" }], exerciseRecords: [{ id: "demo-stretch", at: sampleTime(3), name: "拉伸", duration: 20, calories: 80 }], sleepRecords: [{ id: "demo-sleep-dad", at: sampleTime(7), hours: 7.5, quality: "睡得不错" }] }
      ]
    }));
  }

  function joinFamily(existingFamily, code, profile, nickname) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    let family = normalizeFamily(existingFamily);
    if (!family || family.inviteCode !== normalizedCode) {
      family = demoFamily(profile);
      family.familyId = makeId("family");
      family.familyName = "草莓健康之家";
      family.inviteCode = normalizedCode;
      family.members = family.members.filter(member => member.memberId !== "demo-me");
    }
    const member = memberFromProfile(profile, nickname);
    family.members.push(member);
    family = updateHealthScores(family);
    return { family, currentMemberId: member.memberId };
  }

  function updateNickname(familyValue, memberId, nickname) {
    const family = normalizeFamily(familyValue);
    const member = family?.members.find(item => item.memberId === memberId);
    if (member && String(nickname || "").trim()) member.nickname = String(nickname).trim();
    return family;
  }

  function updateFamilyInfo(familyValue, memberId, familyName, nickname) {
    const family = updateNickname(familyValue, memberId, nickname);
    const normalizedName = String(familyName || "").trim();
    if (family && normalizedName) family.familyName = normalizedName;
    return family;
  }

  function isToday(iso) {
    const date = new Date(iso);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }

  function healthSnapshot(memberValue) {
    const member = normalizeMember(memberValue);
    const foodRecords = member.foodRecords.filter(record => isToday(record.at));
    const exerciseMinutes = member.exerciseRecords
      .filter(record => isToday(record.at))
      .reduce((sum, record) => sum + (Number(record.duration) || 0), 0);
    const foodScore = foodRecords.length ? 100 : 0;
    const exerciseScore = Math.min(100, Math.round((exerciseMinutes / 30) * 100));
    const healthScore = Math.round((foodScore + exerciseScore) / 2);
    return {
      foodCompleted: foodRecords.length > 0,
      foodScore,
      exerciseMinutes,
      exerciseScore,
      healthScore
    };
  }

  function updateHealthScores(familyValue) {
    const family = normalizeFamily(familyValue);
    if (!family) return null;
    family.members.forEach(member => { member.healthScore = healthSnapshot(member).healthScore; });
    return family;
  }

  function sharePersonalLogs(familyValue, memberId, logs) {
    const family = normalizeFamily(familyValue);
    const member = family?.members.find(item => item.memberId === memberId);
    if (!member) return family;
    for (const log of (Array.isArray(logs) ? logs : []).filter(log => isToday(log.at))) {
      if (log.type === "meal" && !member.foodRecords.some(record => String(record.sourceId) === String(log.id))) {
        member.foodRecords.push({ id: makeId("food"), sourceId: log.id, at: log.at, mealType: log.mealType, name: log.foodName || log.note || "饮食记录", foods: log.foods || [log.foodName || log.note || "饮食记录"], calories: Number(log.value) || 0, protein: Number(log.protein) || 0, carbs: Number(log.carbs) || 0, fat: Number(log.fat) || 0, image: log.image || "" });
      }
      if (["activity", "video"].includes(log.type) && !member.exerciseRecords.some(record => String(record.sourceId) === String(log.id))) {
        member.exerciseRecords.push({ id: makeId("exercise"), sourceId: log.id, at: log.at, name: log.type === "video" ? `${log.platform || "视频"}跟练` : (log.note || "运动"), duration: Number(log.duration || log.value) || 0, calories: Number(log.calories || 0) || 0, image: log.image || "" });
      }
    }
    return updateHealthScores(family);
  }

  function activityFeed(familyValue) {
    const family = normalizeFamily(familyValue);
    if (!family) return [];
    const feed = [];
    for (const member of family.members) {
      if (member.privacy.shareFood) member.foodRecords.forEach(record => feed.push({ type: "food", memberId: member.memberId, nickname: member.nickname, avatar: member.avatar, ...record }));
      if (member.privacy.shareExercise) member.exerciseRecords.forEach(record => feed.push({ type: "exercise", memberId: member.memberId, nickname: member.nickname, avatar: member.avatar, ...record }));
    }
    return feed.sort((left, right) => new Date(right.at) - new Date(left.at));
  }

  function memberStatus(memberValue) {
    const member = normalizeMember(memberValue);
    const candidates = [
      ...member.foodRecords.filter(record => isToday(record.at)).map(record => ({ at: record.at, text: `今日饮食已记录 · ${record.name}` })),
      ...member.exerciseRecords.filter(record => isToday(record.at)).map(record => ({ at: record.at, text: `今日运动 ${Number(record.duration) || 0} 分钟` }))
    ].sort((left, right) => new Date(right.at) - new Date(left.at));
    return candidates[0]?.text || "今天还没有共享动态";
  }

  global.FamilyHealthSystem = Object.freeze({ DEFAULT_PRIVACY, normalizeMember, normalizeFamily, createFamily, joinFamily, demoFamily, updateNickname, updateFamilyInfo, sharePersonalLogs, activityFeed, memberStatus, healthSnapshot, updateHealthScores });
})(window);
