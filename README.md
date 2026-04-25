# GF Live Search

Instant live filtering for the Gravity Forms forms list.

<img width="610" height="273" alt="{1F5ECAF2-0E85-4C94-8701-FF81A74E198C}" src="https://github.com/user-attachments/assets/40b11304-b34a-4f5d-9927-4785498de237" />


## Live Search

As you type in the search box on **Forms → Forms**, rows are instantly shown or hidden.

- **Searches across** form title, form ID, entry count — anything visible in the row
- **Searches the full current view** by preloading the other paginated Forms-list pages in the background
- **Diacritics-tolerant** — `e` matches `é`, `ü` matches `u`, etc.
- **Debounced** — filters fire after 150 ms of typing silence to stay responsive
- **Enter key safe** — suppresses native form submission while a query is active
- **No-results message** — shows a clear message when nothing matches

## Keyboard Shortcuts

Focus the search box from anywhere on the page without touching the mouse.

- **`/`** — press once to jump to the search box instantly
- **`Ctrl/Cmd+F` badge** — a compact badge inside the search field lets each user choose between browser find and focusing the live-search box
- **Live counter** — the "X items" badge updates to reflect how many forms are visible

## Key Features

- **Multilingual:** Works with form names in any language
- **Translation-Ready:** PHP strings use the plugin textdomain, and JS strings have a PHP-powered fallback when script-translation JSON files are not present
- **Secure:** Assets load only on the Gravity Forms forms list screen; all query vars are sanitized before use
- **GitHub Updates:** Automatic updates delivered through the standard WordPress update interface

## Requirements

- Gravity Forms (any recent version)
- WordPress 5.8 or higher
- PHP 7.4 or higher

## Installation

1. Upload the `gf-live-search` folder to `/wp-content/plugins/`
2. Activate the plugin through the **Plugins** menu in WordPress
3. Open **Forms → Forms** — live filtering is active immediately, no configuration needed

## FAQ

### Does this work without Gravity Forms?
No. The plugin targets the Gravity Forms forms list page exclusively and will not load anywhere else.

### Will it work with a large number of forms?
Yes. The plugin filters in the browser and also preloads the other paginated rows for the current view in the background, so live search still covers all forms without a reload.

### Does it interfere with Gravity Forms' own search?
No. Typing and pressing **Enter** with an active query is suppressed so the page does not reload. Clearing the input and pressing **Enter** submits normally, which lets Gravity Forms' server-side search clear itself.

### Can I translate the UI strings?
Yes. Place a compiled `.po`/`.mo` pair and the corresponding JSON file for script translations in the `languages/` folder, following the `gf-live-search-{locale}` naming convention.

## Project Structure

```
.
├── gf-live-search.php              # Main plugin file
├── README.md
├── assets
│   ├── gf-live-search.css          # Admin styles for the search UI
│   └── gf-live-search.js           # Live-filter logic and keyboard shortcuts
├── includes
│   └── class-github-updater.php    # GitHub auto-updates
└── languages
    ├── gf-live-search-fr_FR.po     # French translation (source)
    └── gf-live-search.pot          # Translation template
```

## Changelog

### 1.0.3 - 2026-04-25
- Add an inline shortcut badge with a popover to control what `Ctrl/Cmd+F` does
- Default `Ctrl/Cmd+F` to the browser find action unless a user opts into focusing the search box
- Replace the PHP 8-only `str_ends_with()` updater check with a PHP 7.4-safe suffix check

### 1.0.2 - 2026-04-22
- Load the plugin textdomain explicitly
- Fix French JS translations when script-translation JSON files are not generated

### 1.0.1 - 2026-04-22
- Search across all paginated forms in the current view
- Fix the empty-state row width/background on the Gravity Forms list table

### 1.0.0 - 2026-04-21
- Initial release

## License

This project is licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later) — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with love for the WordPress community
</p>
