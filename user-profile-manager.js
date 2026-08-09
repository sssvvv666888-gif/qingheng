(function createUserProfileManager(global) {
  const EMPTY_AVATAR = "";

  function normalize(profile = {}) {
    const source = profile && typeof profile === "object" ? profile : {};
    return {
      avatar: typeof source.avatar === "string" ? source.avatar : EMPTY_AVATAR,
      name: String(source.name || "").trim(),
      signature: String(source.signature || "").trim(),
      currentWeight: Number(source.currentWeight) || 0,
      goalWeight: Number(source.goalWeight) || 0,
      height: Number(source.height) || 0
    };
  }

  function isComplete(profile) {
    const normalized = normalize(profile);
    return Boolean(
      normalized.name
      && normalized.currentWeight > 0
      && normalized.goalWeight > 0
      && normalized.height > 0
    );
  }

  function update(currentProfile, changes = {}) {
    return normalize({ ...normalize(currentProfile), ...changes });
  }

  function removeAvatar(profile) {
    return update(profile, { avatar: EMPTY_AVATAR });
  }

  global.UserProfileManager = Object.freeze({
    EMPTY_AVATAR,
    normalize,
    isComplete,
    update,
    removeAvatar
  });
})(window);
