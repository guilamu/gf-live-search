/**
 * GF Live Search – assets/gf-live-search.js
 *
 * Intercepts keystrokes in the Gravity Forms forms-list search box and
 * instantly shows/hides table rows without a page reload.
 *
 * Compatible with GF's standard WP_List_Table output:
 *   <form id="form_list_search"> … <input name="s" …> … </form>
 *   <table class="wp-list-table widefat …">
 *     <tbody id="the-list">
 *       <tr class="gf_form_list"> … <td class="column-title">Form Name</td> …
 */
( function () {
    'use strict';

    var __ = ( window.wp && window.wp.i18n && window.wp.i18n.__ ) || function ( text ) {
        return text;
    };
    var _n = ( window.wp && window.wp.i18n && window.wp.i18n._n ) || function ( singular, plural, number ) {
        return number === 1 ? singular : plural;
    };
    var sprintf = ( window.wp && window.wp.i18n && window.wp.i18n.sprintf ) || function ( format, value ) {
        return format.replace( '%d', value );
    };

    /**
     * Returns a debounced version of fn that fires after `delay` ms of silence.
     *
     * @param {Function} fn
     * @param {number}   delay  milliseconds
     * @returns {Function}
     */
    function debounce( fn, delay ) {
        var timer;
        return function () {
            clearTimeout( timer );
            timer = setTimeout( fn, delay );
        };
    }

    /**
     * Normalise a string for case-insensitive, diacritics-tolerant comparison.
     *
     * @param {string} str
     * @returns {string}
     */
    function normalize( str ) {
        return str
            .toLowerCase()
            // Remove common diacritics so é === e, ü === u, etc.
            .normalize( 'NFD' )
            .replace( /[\u0300-\u036f]/g, '' );
    }

    document.addEventListener( 'DOMContentLoaded', function () {

        // ── Target elements ──────────────────────────────────────────────────

        // GF wraps its search in <form id="form_list_search">
        var form = document.getElementById( 'form_list_search' );
        if ( ! form ) {
            return; // not on the forms-list page
        }

        // The text input inside that form (GF uses name="s", same as WP search)
        var input = form.querySelector( 'input[name="s"], input[type="search"], input[type="text"]' );
        if ( ! input ) {
            return;
        }

        var searchBox = form.querySelector( '.search-box' ) || input.parentElement;
        var inputWrap = document.createElement( 'span' );

        if ( searchBox ) {
            searchBox.classList.add( 'gf-live-search-search-box' );
        }

        inputWrap.className = 'gf-live-search-input-wrap';
        input.parentNode.insertBefore( inputWrap, input );
        inputWrap.appendChild( input );

        // The tbody that holds each form row
        var tbody = document.getElementById( 'the-list' );
        if ( ! tbody ) {
            return;
        }

        var table = tbody.closest( 'table' );

        // ── No-results placeholder ────────────────────────────────────────────

        var noResults = document.createElement( 'tr' );
        noResults.id = 'gf-live-search-no-results';

        var noResultsCell = document.createElement( 'td' );
        var noResultsIcon = document.createElement( 'span' );
        var noResultsText = document.createElement( 'span' );
        var headerCells = table ? table.querySelectorAll( 'thead th' ) : [];

        noResultsCell.colSpan = headerCells.length || 1;
        noResultsCell.className = 'gf-live-search-empty';

        noResultsIcon.className = 'gf-live-search-empty-icon';
        noResultsIcon.setAttribute( 'aria-hidden', 'true' );
        noResultsIcon.textContent = '\ud83d\udd0d';

        noResultsText.textContent = __( 'No forms match your search.', 'gf-live-search' );

        noResultsCell.appendChild( noResultsIcon );
        noResultsCell.appendChild( noResultsText );
        noResults.appendChild( noResultsCell );
        noResults.style.display = 'none';
        tbody.appendChild( noResults );

        if ( searchBox ) {
            var shortcutHint = document.createElement( 'span' );

            shortcutHint.className = 'gf-live-search-shortcut-hint';
            shortcutHint.setAttribute( 'aria-hidden', 'true' );
            shortcutHint.textContent = __( 'Ctrl/Cmd+F to focus', 'gf-live-search' );
            inputWrap.appendChild( shortcutHint );
        }

        // ── Live filter logic ─────────────────────────────────────────────────

        function syncInputState() {
            form.classList.toggle( 'gf-live-search-has-value', input.value.trim() !== '' );
        }

        /**
         * Filter table rows based on the current input value.
         * Searches across: form title, form ID, entry count.
         */
        function filterForms() {
            var query = normalize( input.value.trim() );

            // Cache all data rows (exclude our own no-results row)
            var rows = Array.prototype.slice.call( tbody.querySelectorAll( 'tr:not(#gf-live-search-no-results)' ) );

            var visibleCount = 0;

            rows.forEach( function ( row ) {
                if ( ! query ) {
                    row.hidden = false;
                    visibleCount++;
                    return;
                }

                // Clone the row and strip hidden row-action links before reading text.
                // GF injects action links (Edit | Settings | … | Export) into every row;
                // they are invisible but present in textContent, causing false positives.
                var clone = row.cloneNode( true );
                var actions = clone.querySelectorAll( '.row-actions' );
                actions.forEach( function ( el ) { el.parentNode.removeChild( el ); } );

                var haystack = normalize( clone.textContent || '' );

                var matches = haystack.indexOf( query ) !== -1;
                row.hidden = ! matches;
                if ( matches ) { visibleCount++; }
            } );

            // Toggle the no-results row
            noResults.style.display = ( query && visibleCount === 0 ) ? '' : 'none';

            // Update the visual counter badge (GF shows "X items" above the table)
            updateCountBadge( visibleCount, query );
            syncInputState();
        }

        /**
         * Update GF's native "X items" count label while filtering.
         * GF outputs this in .displaying-num inside .tablenav
         *
         * @param {number}  count
         * @param {string}  query  current normalised query
         */
        function updateCountBadge( count, query ) {
            var badges = document.querySelectorAll( '.displaying-num' );

            if ( ! badges.length ) { return; }

            badges.forEach( function ( badge ) {
                if ( ! query ) {
                    if ( badge.dataset.gflsOriginal ) {
                        badge.textContent = badge.dataset.gflsOriginal;
                    }
                    return;
                }

                if ( ! badge.dataset.gflsOriginal ) {
                    badge.dataset.gflsOriginal = badge.textContent;
                }

                badge.textContent = sprintf(
                    _n( '%d form', '%d forms', count, 'gf-live-search' ),
                    count
                );
            } );
        }

        // ── Prevent form submission while live-filtering ───────────────────────

        /**
         * When the user presses Enter inside the search box and there is
         * an active live-filter query, we suppress the native GF form
         * submission so the page does not reload. If the input is empty,
         * we let the form submit normally (to clear a previous server-side
         * search).
         */
        input.addEventListener( 'keydown', function ( e ) {
            if ( e.key === 'Enter' && input.value.trim() !== '' ) {
                e.preventDefault();
            }
        } );

        // ── Wire up the input ─────────────────────────────────────────────────

        var debouncedFilter = debounce( filterForms, 150 );

        input.addEventListener( 'input', debouncedFilter );

        // Also handle programmatic value changes (e.g. browser autofill)
        input.addEventListener( 'change', filterForms );

        syncInputState();

        // Instantly filter when the page loads with a pre-filled value
        // (e.g. the user refreshed with ?s=foo in the URL)
        if ( input.value.trim() !== '' ) {
            filterForms();
        }

        // ── Keyboard shortcuts: "/" and Ctrl/Cmd+F focus the search box ──────

        function focusSearchInput() {
            input.focus();
            input.select();
        }

        document.addEventListener( 'keydown', function ( e ) {
            var tag = ( document.activeElement && document.activeElement.tagName ) || '';
            var activeElement = document.activeElement;
            var inEditable = (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                tag === 'SELECT' ||
                ( activeElement && activeElement.isContentEditable )
            );
            var wantsFind = ( e.key && e.key.toLowerCase() === 'f' && ( e.ctrlKey || e.metaKey ) && ! e.altKey );

            if ( inEditable ) { return; }

            // "/" key (common in list-heavy UIs like GitHub, Linear)
            if ( e.key === '/' ) {
                e.preventDefault();
                focusSearchInput();
                return;
            }

            if ( wantsFind ) {
                e.preventDefault();
                focusSearchInput();
            }
        } );

    } );

} )();
