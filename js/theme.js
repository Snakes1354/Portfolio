// Shared by every page: applies the saved light/dark theme and runs the theme button.
const themeButton = document.querySelector('.settings-button');
let savedTheme = null;

try {
  savedTheme = localStorage.getItem('portfolio-theme');
} catch {
  // Theme switching still works when browser storage is unavailable.
}

const setTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  themeButton.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
  themeButton.title = `Switch to ${nextTheme} mode`;

  try {
    localStorage.setItem('portfolio-theme', theme);
  } catch {
    // The selected theme remains active for the current page.
  }
};

setTheme(savedTheme === 'light' ? 'light' : 'dark');

themeButton.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
