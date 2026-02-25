const THEME_KEY = "themeMode";

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") {
    return saved;
  }

  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(mode) {
  const isDark = mode === "dark";
  document.body.classList.toggle("dark-mode", isDark);

  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.textContent = isDark ? "Lys" : "Mork";
    button.setAttribute("aria-pressed", String(isDark));
  });
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark-mode");
  const next = isDark ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

window.addEventListener("DOMContentLoaded", () => {
  const initial = getInitialTheme();
  applyTheme(initial);

  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.addEventListener("click", toggleTheme);
  });
});
