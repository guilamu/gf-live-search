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

    var i18nData = window.gfLiveSearchI18n || {};
    var hasOwn = Object.prototype.hasOwnProperty;
    var wpI18n = window.wp && window.wp.i18n ? window.wp.i18n : null;

    function __( text, domain ) {
        if ( i18nData.strings && hasOwn.call( i18nData.strings, text ) ) {
            return i18nData.strings[ text ];
        }

        if ( wpI18n && wpI18n.__ ) {
            return wpI18n.__( text, domain );
        }

        return text;
    }

    function _n( singular, plural, number, domain ) {
        if ( i18nData.plurals && hasOwn.call( i18nData.plurals, singular ) ) {
            return number === 1 ? i18nData.plurals[ singular ][ 0 ] : i18nData.plurals[ singular ][ 1 ];
        }

        if ( wpI18n && wpI18n._n ) {
            return wpI18n._n( singular, plural, number, domain );
        }

        return number === 1 ? singular : plural;
    }

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

    /**
     * Convert array-like collections into real arrays.
     *
     * @param {*} list
     * @returns {Array}
     */
    function toArray( list ) {
        return Array.prototype.slice.call( list || [] );
    }

    /**
     * Count all header cells, including the checkbox column rendered as a td.
     *
     * @param {HTMLTableElement} tableElement
     * @returns {number}
     */
    function getColumnCount( tableElement ) {
        var headerRow = tableElement && tableElement.tHead && tableElement.tHead.rows.length
            ? tableElement.tHead.rows[ 0 ]
            : null;

        if ( ! headerRow ) {
            return 1;
        }

        return toArray( headerRow.children ).reduce( function ( total, cell ) {
            var span = parseInt( cell.getAttribute( 'colspan' ) || '1', 10 );

            return total + ( isNaN( span ) ? 1 : span );
        }, 0 ) || 1;
    }

    /**
     * Get the table rows that represent forms.
     *
     * @param {HTMLElement} container
     * @returns {Array<HTMLTableRowElement>}
     */
    function getFormRows( container ) {
        return toArray( container && container.children ).filter( function ( row ) {
            return row && row.tagName === 'TR' && row.id !== 'gf-live-search-no-results';
        } );
    }

    /**
     * Remove text that should not influence live-search matching.
     *
     * @param {HTMLElement} root
     * @param {string} selector
     */
    function removeMatches( root, selector ) {
        toArray( root.querySelectorAll( selector ) ).forEach( function ( element ) {
            element.parentNode.removeChild( element );
        } );
    }

    /**
     * Build the searchable text for a single row.
     *
     * @param {HTMLTableRowElement} row
     * @returns {string}
     */
    function getRowSearchText( row ) {
        var clone = row.cloneNode( true );

        removeMatches( clone, '.row-actions, .screen-reader-text, .toggle-row' );

        return normalize( clone.textContent || '' );
    }

    /**
     * Cache searchable metadata on a row.
     *
     * @param {HTMLTableRowElement} row
     * @returns {HTMLTableRowElement}
     */
    function primeRow( row ) {
        row.dataset.gflsSearchText = getRowSearchText( row );
        return row;
    }

    /**
     * Read the current paged view from the list table controls.
     *
     * @returns {number}
     */
    function getCurrentPageNumber() {
        var pageInput = document.querySelector( '.tablenav-pages .current-page' );
        var page = pageInput ? parseInt( pageInput.value, 10 ) : NaN;

        if ( ! isNaN( page ) && page > 0 ) {
            return page;
        }

        try {
            page = parseInt( new URL( window.location.href ).searchParams.get( 'paged' ) || '1', 10 );
        } catch ( error ) {
            page = 1;
        }

        return ! isNaN( page ) && page > 0 ? page : 1;
    }

    /**
     * Read the total number of paginated pages from the current screen.
     *
     * @returns {number}
     */
    function getTotalPages() {
        var total = 1;

        toArray( document.querySelectorAll( '.tablenav-pages .total-pages' ) ).forEach( function ( element ) {
            var value = parseInt( ( element.textContent || '' ).trim(), 10 );

            if ( ! isNaN( value ) && value > total ) {
                total = value;
            }
        } );

        return total;
    }

    /**
     * Build the URL for another paginated view of the same forms list.
     *
     * @param {number} pageNumber
     * @returns {string}
     */
    function getPageUrl( pageNumber ) {
        var url = new URL( window.location.href );

        url.searchParams.set( 'paged', String( pageNumber ) );

        return url.toString();
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
        var currentPage = getCurrentPageNumber();
        var totalPages = getTotalPages();
        var currentRows = getFormRows( tbody ).map( primeRow );
        var remoteRows = [];
        var preloadPromise = null;

        // ── No-results placeholder ────────────────────────────────────────────

        var noResults = document.createElement( 'tr' );
        noResults.id = 'gf-live-search-no-results';

        var noResultsCell = document.createElement( 'td' );
        var noResultsIcon = document.createElement( 'span' );
        var noResultsText = document.createElement( 'span' );

        noResultsCell.colSpan = table ? getColumnCount( table ) : 1;
        noResultsCell.className = 'gf-live-search-empty';

        noResultsIcon.className = 'gf-live-search-empty-icon';
        noResultsIcon.setAttribute( 'aria-hidden', 'true' );
        noResultsIcon.textContent = '\ud83d\udd0d';

        noResultsText.textContent = __( 'No forms match your search.', 'gf-live-search' );

        noResultsCell.appendChild( noResultsIcon );
        noResultsCell.appendChild( noResultsText );
        noResults.appendChild( noResultsCell );
        noResults.hidden = true;
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
         * Start loading the remaining paginated form rows in the background.
         *
         * @returns {Promise<Array<HTMLTableRowElement>>}
         */
        function preloadOtherPages() {
            var pageNumbers = [];

            if ( preloadPromise ) {
                return preloadPromise;
            }

            if ( totalPages <= 1 || ! window.fetch || ! window.DOMParser || ! window.URL ) {
                preloadPromise = Promise.resolve( remoteRows );
                return preloadPromise;
            }

            for ( var pageNumber = 1; pageNumber <= totalPages; pageNumber++ ) {
                if ( pageNumber !== currentPage ) {
                    pageNumbers.push( pageNumber );
                }
            }

            preloadPromise = Promise.all( pageNumbers.map( function ( pageNumber ) {
                return fetch( getPageUrl( pageNumber ), {
                    credentials: 'same-origin',
                } )
                    .then( function ( response ) {
                        if ( ! response.ok ) {
                            throw new Error( 'Failed to load additional forms-list pages.' );
                        }

                        return response.text();
                    } )
                    .then( function ( html ) {
                        var parser = new DOMParser();
                        var page = parser.parseFromString( html, 'text/html' );
                        var pageTbody = page.getElementById( 'the-list' );

                        if ( ! pageTbody ) {
                            return [];
                        }

                        return getFormRows( pageTbody ).map( function ( row ) {
                            var importedRow = document.importNode( row, true );

                            importedRow.hidden = true;

                            return primeRow( importedRow );
                        } );
                    } );
            } ) )
                .then( function ( rowGroups ) {
                    rowGroups.forEach( function ( rows ) {
                        rows.forEach( function ( row ) {
                            remoteRows.push( row );
                            tbody.insertBefore( row, noResults );
                        } );
                    } );

                    if ( input.value.trim() !== '' ) {
                        filterForms();
                    }

                    return remoteRows;
                } )
                .catch( function () {
                    return remoteRows;
                } );

            return preloadPromise;
        }

        /**
         * Filter table rows based on the current input value.
         * Searches across: form title, form ID, entry count.
         */
        function filterForms() {
            var query = normalize( input.value.trim() );
            var rows = currentRows.concat( remoteRows );

            var visibleCount = 0;

            if ( ! query ) {
                currentRows.forEach( function ( row ) {
                    row.hidden = false;
                } );

                remoteRows.forEach( function ( row ) {
                    row.hidden = true;
                } );

                noResults.hidden = true;
                updateCountBadge( visibleCount, query );
                syncInputState();

                return;
            }

            rows.forEach( function ( row ) {
                var haystack = row.dataset.gflsSearchText || '';

                var matches = haystack.indexOf( query ) !== -1;
                row.hidden = ! matches;
                if ( matches ) { visibleCount++; }
            } );

            // Toggle the no-results row
            noResults.hidden = visibleCount !== 0;

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
        preloadOtherPages();

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
