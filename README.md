# GF Live Search

Instant live filtering for the Gravity Forms forms list.

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
- **`Ctrl/Cmd+F`** — intercepts the browser find shortcut and redirects it to the search box
- **Live counter** — the "X items" badge updates to reflect how many forms are visible

## Key Features

- **Multilingual:** Works with form names in any language
- **Translation-Ready:** All UI strings are internationalized and loaded via `wp_set_script_translations`
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

### 1.0.1
- Search across all paginated forms in the current view
- Fix the empty-state row width/background on the Gravity Forms list table

### 1.0.0
- Initial release

## License

This project is licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later) — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with love for the WordPress community
</p>
