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
    var shortcutStorageKey = 'gfLiveSearchShortcutMode';

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
     * Compute the Levenshtein distance between two strings.
     *
     * @param {string} a
     * @param {string} b
     * @returns {number}
     */
    function levenshteinDistance( a, b ) {
        var m = a.length;
        var n = b.length;

        if ( m === 0 ) {
            return n;
        }
        if ( n === 0 ) {
            return m;
        }

        var matrix = [];
        var i, j;

        for ( i = 0; i <= m; i++ ) {
            matrix[ i ] = [ i ];
        }
        for ( j = 0; j <= n; j++ ) {
            matrix[ 0 ][ j ] = j;
        }

        for ( i = 1; i <= m; i++ ) {
            for ( j = 1; j <= n; j++ ) {
                var cost = a.charAt( i - 1 ) === b.charAt( j - 1 ) ? 0 : 1;
                matrix[ i ][ j ] = Math.min(
                    matrix[ i - 1 ][ j ] + 1,       // deletion
                    matrix[ i ][ j - 1 ] + 1,       // insertion
                    matrix[ i - 1 ][ j - 1 ] + cost // substitution
                );
            }
        }

        return matrix[ m ][ n ];
    }

    /**
     * Split text into whitespace-delimited words.
     *
     * @param {string} text
     * @returns {Array<string>}
     */
    function getWords( text ) {
        return text.split( /\s+/ ).filter( function ( w ) {
            return w.length > 0;
        } );
    }

    /**
     * Maximum permissible edit distance for a fuzzy match on a word of the
     * given length (≈ 40 %, never below 1).
     *
     * @param {number} wordLength
     * @returns {number}
     */
    function getFuzzyThreshold( wordLength ) {
        return Math.max( 1, Math.round( wordLength * 0.3 ) );
    }

    /**
     * Score a single row against a set of query words (AND logic).
     *
     * @param {string}       rowText
     * @param {Array<string>} queryWords
     * @returns {{score: number, matchedWords: Array<string>}}
     */
    function scoreRow( rowText, queryWords ) {
        var rowWords = getWords( rowText );
        var totalScore = 0;
        var matchedWords = [];
        var allMatched = true;

        for ( var q = 0; q < queryWords.length; q++ ) {
            var queryWord = queryWords[ q ];
            var bestScore = 0;
            var bestMatchWord = '';
            var matched = false;

            // 1. Exact substring anywhere in the full row text.
            if ( rowText.indexOf( queryWord ) !== -1 ) {
                bestScore = 1000;
                matched = true;

                // Identify the word that contains the substring for highlighting.
                for ( var r = 0; r < rowWords.length; r++ ) {
                    if ( rowWords[ r ].indexOf( queryWord ) !== -1 ) {
                        bestMatchWord = rowWords[ r ];
                        break;
                    }
                }
                if ( ! bestMatchWord ) {
                    bestMatchWord = queryWord;
                }
            } else {
                // 2–4. Word-level matching.
                for ( var r = 0; r < rowWords.length; r++ ) {
                    var rowWord = rowWords[ r ];
                    var score = 0;
                    var matchWord = '';

                    if ( rowWord === queryWord ) {
                        score = 500;
                        matchWord = rowWord;
                    } else if ( rowWord.indexOf( queryWord ) !== -1 || queryWord.indexOf( rowWord ) !== -1 ) {
                        score = 100;
                        matchWord = rowWord;
                    } else {
                        var threshold = getFuzzyThreshold( rowWord.length );
                        var lengthDiff = Math.abs( queryWord.length - rowWord.length );

                        if ( lengthDiff <= threshold ) {
                            var dist = levenshteinDistance( queryWord, rowWord );
                            if ( dist <= threshold ) {
                                score = Math.max( 0, 300 - dist * 10 );
                                matchWord = rowWord;
                            }
                        }
                    }

                    if ( score > bestScore ) {
                        bestScore = score;
                        bestMatchWord = matchWord;
                    }
                }

                matched = bestScore > 0;
            }

            if ( matched ) {
                totalScore += bestScore;
                if ( bestMatchWord && matchedWords.indexOf( bestMatchWord ) === -1 ) {
                    matchedWords.push( bestMatchWord );
                }
            } else {
                allMatched = false;
                break;
            }
        }

        if ( ! allMatched ) {
            return { score: 0, matchedWords: [] };
        }

        return { score: totalScore, matchedWords: matchedWords };
    }

    /**
     * Restore a row to its original (un-highlighted) HTML.
     *
     * @param {HTMLTableRowElement} row
     */
    function restoreRow( row ) {
        if ( row.dataset.gflsOriginalHtml ) {
            row.innerHTML = row.dataset.gflsOriginalHtml;
        }
    }

    /**
     * Wrap matched whole words in <mark> elements inside a row.
     *
     * @param {HTMLTableRowElement} row
     * @param {Array<string>}       wordsToHighlight  normalised words
     */
    function highlightRow( row, wordsToHighlight ) {
        if ( ! wordsToHighlight || ! wordsToHighlight.length ) {
            return;
        }

        restoreRow( row );

        var walker = document.createTreeWalker( row, NodeFilter.SHOW_TEXT, null, false );
        var textNodes = [];
        var node;

        while ( ( node = walker.nextNode() ) ) {
            var parentTag = node.parentNode && node.parentNode.tagName;
            if ( parentTag === 'MARK' || parentTag === 'SCRIPT' || parentTag === 'STYLE' ) {
                continue;
            }
            textNodes.push( node );
        }

        textNodes.forEach( function ( textNode ) {
            var text = textNode.textContent;
            if ( ! text ) {
                return;
            }

            var segments = text.split( /(\s+)/ );
            var hasHighlight = false;
            var fragment = document.createDocumentFragment();

            segments.forEach( function ( segment ) {
                if ( ! segment || /^\s+$/.test( segment ) ) {
                    fragment.appendChild( document.createTextNode( segment || '' ) );
                    return;
                }

                var normalizedSegment = normalize( segment );
                var shouldHighlight = false;

                for ( var i = 0; i < wordsToHighlight.length; i++ ) {
                    var hw = normalize( wordsToHighlight[ i ] );
                    var maxLen = Math.max( normalizedSegment.length, hw.length );
                    var threshold = getFuzzyThreshold( maxLen );
                    var lengthDiff = Math.abs( normalizedSegment.length - hw.length );
                    var dist;

                    if ( normalizedSegment === hw ||
                         normalizedSegment.indexOf( hw ) !== -1 ||
                         hw.indexOf( normalizedSegment ) !== -1 ) {
                        shouldHighlight = true;
                        break;
                    }

                    if ( lengthDiff <= threshold ) {
                        dist = levenshteinDistance( normalizedSegment, hw );
                        if ( dist <= threshold ) {
                            shouldHighlight = true;
                            break;
                        }
                    }
                }

                if ( shouldHighlight ) {
                    hasHighlight = true;
                    var mark = document.createElement( 'mark' );
                    mark.className = 'gfls-highlight';
                    mark.textContent = segment;
                    fragment.appendChild( mark );
                } else {
                    fragment.appendChild( document.createTextNode( segment ) );
                }
            } );

            if ( hasHighlight ) {
                textNode.parentNode.replaceChild( fragment, textNode );
            }
        } );
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

        if ( ! row.dataset.gflsOriginalHtml ) {
            row.dataset.gflsOriginalHtml = row.innerHTML;
        }

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

    function getShortcutMode() {
        try {
            var savedMode = window.localStorage ? window.localStorage.getItem( shortcutStorageKey ) : '';

            if ( savedMode === 'browser' || savedMode === 'search' ) {
                return savedMode;
            }
        } catch ( error ) {
            return 'browser';
        }

        return 'browser';
    }

    function persistShortcutMode( mode ) {
        try {
            if ( window.localStorage ) {
                window.localStorage.setItem( shortcutStorageKey, mode );
            }
        } catch ( error ) {
            return;
        }
    }

    function getShortcutBadgeLabel() {
        var platform = '';

        try {
            if ( window.navigator ) {
                platform =
                    ( window.navigator.userAgentData && window.navigator.userAgentData.platform ) ||
                    window.navigator.platform ||
                    '';
            }
        } catch ( error ) {
            platform = '';
        }

        return String( platform ).toLowerCase().indexOf( 'mac' ) !== -1 ? '\u2318F' : 'Ctrl+F';
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
        var shortcutMode = getShortcutMode();
        var shortcutBadge = null;
        var shortcutPopover = null;
        var browserOption = null;
        var searchOption = null;

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

        function setShortcutPopoverState( isOpen ) {
            if ( ! shortcutPopover || ! shortcutBadge ) {
                return;
            }

            shortcutPopover.hidden = ! isOpen;
            shortcutBadge.setAttribute( 'aria-expanded', isOpen ? 'true' : 'false' );
        }

        function syncShortcutUi() {
            inputWrap.dataset.gflsShortcutMode = shortcutMode;

            if ( browserOption ) {
                browserOption.setAttribute( 'aria-pressed', shortcutMode === 'browser' ? 'true' : 'false' );
            }

            if ( searchOption ) {
                searchOption.setAttribute( 'aria-pressed', shortcutMode === 'search' ? 'true' : 'false' );
            }
        }

        function setShortcutMode( nextMode ) {
            if ( nextMode !== 'browser' && nextMode !== 'search' ) {
                return;
            }

            shortcutMode = nextMode;
            persistShortcutMode( nextMode );
            syncShortcutUi();
        }

        if ( searchBox ) {
            var shortcutBadgeLabel = document.createElement( 'span' );
            var shortcutTitle = document.createElement( 'p' );

            shortcutBadge = document.createElement( 'button' );
            shortcutPopover = document.createElement( 'div' );
            browserOption = document.createElement( 'button' );
            searchOption = document.createElement( 'button' );

            shortcutBadge.type = 'button';
            shortcutBadge.className = 'gf-live-search-shortcut-badge';
            shortcutBadge.setAttribute( 'aria-controls', 'gf-live-search-shortcut-popover' );
            shortcutBadge.setAttribute( 'aria-expanded', 'false' );
            shortcutBadge.setAttribute( 'aria-haspopup', 'true' );
            shortcutBadge.setAttribute( 'aria-label', __( 'Choose what Ctrl/Cmd+F does', 'gf-live-search' ) );

            shortcutBadgeLabel.className = 'gf-live-search-shortcut-badge-label';
            shortcutBadgeLabel.setAttribute( 'aria-hidden', 'true' );
            shortcutBadgeLabel.textContent = getShortcutBadgeLabel();
            shortcutBadge.appendChild( shortcutBadgeLabel );

            shortcutPopover.id = 'gf-live-search-shortcut-popover';
            shortcutPopover.className = 'gf-live-search-shortcut-popover';
            shortcutPopover.hidden = true;

            shortcutTitle.className = 'gf-live-search-shortcut-title';
            shortcutTitle.textContent = __( 'Ctrl/Cmd+F', 'gf-live-search' );
            shortcutPopover.appendChild( shortcutTitle );

            browserOption.type = 'button';
            browserOption.className = 'gf-live-search-shortcut-option';
            browserOption.dataset.gflsShortcutMode = 'browser';
            browserOption.textContent = __( 'Use browser find', 'gf-live-search' );
            shortcutPopover.appendChild( browserOption );

            searchOption.type = 'button';
            searchOption.className = 'gf-live-search-shortcut-option';
            searchOption.dataset.gflsShortcutMode = 'search';
            searchOption.textContent = __( 'Focus this search', 'gf-live-search' );
            shortcutPopover.appendChild( searchOption );

            inputWrap.appendChild( shortcutBadge );
            inputWrap.appendChild( shortcutPopover );
            syncShortcutUi();

            shortcutBadge.addEventListener( 'click', function ( e ) {
                e.preventDefault();
                setShortcutPopoverState( shortcutPopover.hidden );

                if ( ! shortcutPopover.hidden ) {
                    ( shortcutMode === 'search' ? searchOption : browserOption ).focus();
                }
            } );

            browserOption.addEventListener( 'click', function () {
                setShortcutMode( 'browser' );
                setShortcutPopoverState( false );
                shortcutBadge.focus();
            } );

            searchOption.addEventListener( 'click', function () {
                setShortcutMode( 'search' );
                setShortcutPopoverState( false );
                focusSearchInput();
            } );
        }

        document.addEventListener( 'click', function ( e ) {
            if ( ! shortcutPopover || shortcutPopover.hidden ) {
                return;
            }

            if ( inputWrap.contains( e.target ) ) {
                return;
            }

            setShortcutPopoverState( false );
        } );

        document.addEventListener( 'focusin', function ( e ) {
            if ( ! shortcutPopover || shortcutPopover.hidden ) {
                return;
            }

            if ( inputWrap.contains( e.target ) ) {
                return;
            }

            setShortcutPopoverState( false );
        } );

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
         * Uses fuzzy Levenshtein matching, AND logic for multi-word queries,
         * highlights matched words, and re-orders rows so best hits appear first.
         */
        function filterForms() {
            var query = normalize( input.value.trim() );
            var allRows = currentRows.concat( remoteRows );

            if ( ! query ) {
                // Restore original order and visibility.
                currentRows.forEach( function ( row ) {
                    restoreRow( row );
                    row.hidden = false;
                    tbody.insertBefore( row, noResults );
                } );

                remoteRows.forEach( function ( row ) {
                    restoreRow( row );
                    row.hidden = true;
                    tbody.insertBefore( row, noResults );
                } );

                noResults.hidden = true;
                updateCountBadge( 0, query );
                syncInputState();

                return;
            }

            var queryWords = getWords( query );
            var scoredRows = [];

            allRows.forEach( function ( row ) {
                var rowText = row.dataset.gflsSearchText || '';
                var result = scoreRow( rowText, queryWords );

                if ( result.score > 0 ) {
                    scoredRows.push( {
                        row: row,
                        score: result.score,
                        matchedWords: result.matchedWords,
                    } );
                } else {
                    row.hidden = true;
                    restoreRow( row );
                }
            } );

            scoredRows.sort( function ( a, b ) {
                return b.score - a.score;
            } );

            scoredRows.forEach( function ( item ) {
                item.row.hidden = false;
                tbody.insertBefore( item.row, noResults );
                highlightRow( item.row, item.matchedWords );
            } );

            noResults.hidden = scoredRows.length > 0;
            updateCountBadge( scoredRows.length, query );
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

        // ── Keyboard shortcuts: "/" always focuses search, Ctrl/Cmd+F is user-selectable ──

        function focusSearchInput() {
            input.focus();
            input.select();
        }

        document.addEventListener( 'keydown', function ( e ) {
            if ( e.key === 'Escape' && shortcutPopover && ! shortcutPopover.hidden ) {
                e.preventDefault();
                setShortcutPopoverState( false );
                shortcutBadge.focus();
                return;
            }

            var tag = ( document.activeElement && document.activeElement.tagName ) || '';
            var activeElement = document.activeElement;
            var inEditable = (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                tag === 'SELECT' ||
                ( activeElement && activeElement.isContentEditable )
            );
            var inShortcutUi = activeElement && inputWrap.contains( activeElement ) && activeElement !== input;
            var wantsFind = ( e.key && e.key.toLowerCase() === 'f' && ( e.ctrlKey || e.metaKey ) && ! e.altKey );

            if ( inEditable || inShortcutUi ) { return; }

            // "/" key (common in list-heavy UIs like GitHub, Linear)
            if ( e.key === '/' ) {
                e.preventDefault();
                focusSearchInput();
                return;
            }

            if ( wantsFind && shortcutMode === 'search' ) {
                e.preventDefault();
                focusSearchInput();
            }
        } );

    } );

} )();
