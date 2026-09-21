// credit for getting system theme: https://pepelsbey.dev/articles/native-light-dark/

const theme_storage_key = "notes_app_theme";
const system_light_query = window.matchMedia("(prefers-color-scheme: light)");

function load_stored_theme() {
    const stored_theme = localStorage.getItem(theme_storage_key);
    return stored_theme === "light" || stored_theme === "dark" ? stored_theme : null;
}

function get_preferred_theme() {
    return load_stored_theme() || (system_light_query.matches ? "light" : "dark");
}

function apply_theme(theme) {
    document.documentElement.dataset.theme = theme;
    render_theme_toggle(theme);
}

function render_theme_toggle(theme) {
    const theme_toggle = document.getElementById("theme_toggle");

    if (!theme_toggle) {
        return;
    }

    const icon = theme_toggle.querySelector("i");
    const next_theme_label = theme === "light" ? "dark" : "light";

    if (icon) {
        icon.className = theme === "light" ? "bi bi-moon-stars" : "bi bi-sun";
    }

    theme_toggle.setAttribute("aria-label", `Switch to ${next_theme_label} mode`);
    theme_toggle.setAttribute("title", `Switch to ${next_theme_label} mode`);
    theme_toggle.setAttribute("aria-pressed", theme === "light" ? "false" : "true");
}

function toggle_theme() {
    const next_theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem(theme_storage_key, next_theme);
    apply_theme(next_theme);
}

document.documentElement.dataset.theme = get_preferred_theme();

document.addEventListener("DOMContentLoaded", () => {
    const theme_toggle = document.getElementById("theme_toggle");
    render_theme_toggle(document.documentElement.dataset.theme);

    if (theme_toggle) {
        theme_toggle.addEventListener("click", toggle_theme);
    }
});

system_light_query.addEventListener("change", (event) => {
    if (!load_stored_theme()) {
        apply_theme(event.matches ? "light" : "dark");
    }
});