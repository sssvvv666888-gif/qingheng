(function createCompanionSystem(global) {
  const taskTypes = [
    { id: "study", label: "学习", icon: "✎", animation: "轻松熊学习动画" },
    { id: "reading", label: "阅读", icon: "📖", animation: "轻松熊阅读动画" },
    { id: "exercise", label: "运动", icon: "♪", animation: "轻松熊运动动画" },
    { id: "meditation", label: "冥想", icon: "○", animation: "轻松熊冥想动画" },
    { id: "rest", label: "休息", icon: "☁", animation: "轻松熊休息动画" }
  ];

  function render(container, preview, onSelect) {
    if (!container || !preview) return;
    container.innerHTML = taskTypes.map(task => `
      <button type="button" data-companion-task="${task.id}">
        <span>${task.icon}</span><strong>${task.label}</strong><small>${task.animation}</small>
      </button>`).join("");
    preview.innerHTML = '<img src="assets/rilakkuma-from-setting.png" alt=""><div><strong>陪伴计时模块已预留</strong><span>选择一种状态，后续将在这里进入计时页面。</span></div>';
    container.addEventListener("click", event => {
      const button = event.target.closest("[data-companion-task]");
      if (!button) return;
      const selected = taskTypes.find(task => task.id === button.dataset.companionTask);
      container.querySelectorAll("button").forEach(item => item.classList.toggle("is-selected", item === button));
      preview.innerHTML = `<img src="assets/rilakkuma-from-setting.png" alt=""><div><strong>${selected.label}陪伴已选择</strong><span>${selected.animation}将在后续版本接入，计时器目前未启用。</span></div>`;
      if (typeof onSelect === "function") onSelect(selected);
    });
  }

  global.CompanionSystem = Object.freeze({ taskTypes, render });
})(window);
