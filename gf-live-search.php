<?php
/**
 * Plugin Name:       GF Live Search
 * Plugin URI:        https://github.com/guilamu/gf-live-search
 * Description:       Adds live filtering to the Gravity Forms forms list. As you type in the search box, forms are instantly filtered without a page reload.
 * Version:           1.0.2
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Guilamu
 * Author URI:        https://github.com/guilamu
 * License:           AGPL-3.0-or-later
 * License URI:       https://www.gnu.org/licenses/agpl-3.0.html
 * Text Domain:       gf-live-search
 * Domain Path:       /languages
 * Update URI:        https://github.com/guilamu/gf-live-search/
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'GF_LIVE_SEARCH_VERSION', '1.0.2' );
define( 'GF_LIVE_SEARCH_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'GF_LIVE_SEARCH_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

// GitHub auto-updater
require_once GF_LIVE_SEARCH_PLUGIN_DIR . 'includes/class-github-updater.php';

/**
 * Main plugin class.
 */
class GF_Live_Search {

    private static $instance = null;

    public static function get_instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action( 'plugins_loaded', [ $this, 'load_textdomain' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_assets' ] );
    }

    /**
     * Load translations from the plugin languages directory.
     */
    public function load_textdomain(): void {
        load_plugin_textdomain(
            'gf-live-search',
            false,
            dirname( plugin_basename( __FILE__ ) ) . '/languages'
        );
    }

    /**
     * Only load assets on the Gravity Forms forms list page.
     *
     * @param string $hook_suffix Current admin page hook suffix.
     */
    public function enqueue_assets( string $hook_suffix ): void {
        $screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;

        $is_gf_forms_list = (
            'toplevel_page_gf_edit_forms' === $hook_suffix ||
            ( $screen && 'toplevel_page_gf_edit_forms' === $screen->id )
        );

        $page = '';
        if ( isset( $_GET['page'] ) && ! is_array( $_GET['page'] ) ) {
            $page = sanitize_key( wp_unslash( $_GET['page'] ) );
        }

        $form_id = 0;
        if ( isset( $_GET['id'] ) && ! is_array( $_GET['id'] ) ) {
            $form_id = absint( wp_unslash( $_GET['id'] ) );
        }

        if ( ! $is_gf_forms_list || 'gf_edit_forms' !== $page || $form_id > 0 ) {
            return;
        }

        wp_enqueue_script(
            'gf-live-search',
            GF_LIVE_SEARCH_PLUGIN_URL . 'assets/gf-live-search.js',
            [ 'wp-i18n' ],
            GF_LIVE_SEARCH_VERSION,
            true
        );

        wp_add_inline_script(
            'gf-live-search',
            'window.gfLiveSearchI18n = ' . wp_json_encode( $this->get_script_translations() ) . ';',
            'before'
        );

        if ( function_exists( 'wp_set_script_translations' ) ) {
            wp_set_script_translations( 'gf-live-search', 'gf-live-search', GF_LIVE_SEARCH_PLUGIN_DIR . 'languages' );
        }

        wp_enqueue_style(
            'gf-live-search',
            GF_LIVE_SEARCH_PLUGIN_URL . 'assets/gf-live-search.css',
            [],
            GF_LIVE_SEARCH_VERSION
        );
    }

    /**
     * Get translated strings used by the admin script.
     *
     * @return array<string, mixed>
     */
    private function get_script_translations(): array {
        return [
            'strings' => [
                'No forms match your search.' => __( 'No forms match your search.', 'gf-live-search' ),
                'Ctrl/Cmd+F to focus'        => __( 'Ctrl/Cmd+F to focus', 'gf-live-search' ),
            ],
            'plurals' => [
                '%d form' => [
                    _n( '%d form', '%d forms', 1, 'gf-live-search' ),
                    _n( '%d form', '%d forms', 2, 'gf-live-search' ),
                ],
            ],
        ];
    }
}

GF_Live_Search::get_instance();

/**
 * Register with Guilamu Bug Reporter (if installed).
 */
add_action( 'plugins_loaded', function () {
    if ( class_exists( 'Guilamu_Bug_Reporter' ) ) {
        Guilamu_Bug_Reporter::register( array(
            'slug'        => 'gf-live-search',
            'name'        => 'GF Live Search',
            'version'     => GF_LIVE_SEARCH_VERSION,
            'github_repo' => 'guilamu/gf-live-search',
        ) );
    }
}, 20 );

/**
 * Add "Report a Bug" link to the plugin row in Plugins > Installed Plugins.
 */
add_filter( 'plugin_row_meta', function ( array $links, string $file ): array {
    if ( plugin_basename( __FILE__ ) !== $file ) {
        return $links;
    }

    // "View details" thickbox link — same pattern as WordPress.org-hosted plugins.
    $links[] = sprintf(
        '<a href="%s" class="thickbox open-plugin-details-modal" aria-label="%s" data-title="%s">%s</a>',
        esc_url( self_admin_url(
            'plugin-install.php?tab=plugin-information&plugin=gf-live-search&TB_iframe=true&width=772&height=926'
        ) ),
        esc_attr__( 'More information about GF Live Search', 'gf-live-search' ),
        esc_attr__( 'GF Live Search', 'gf-live-search' ),
        esc_html__( 'View details', 'gf-live-search' )
    );

    if ( class_exists( 'Guilamu_Bug_Reporter' ) ) {
        $links[] = sprintf(
            '<a href="#" class="guilamu-bug-report-btn" data-plugin-slug="gf-live-search" data-plugin-name="%s">%s</a>',
            esc_attr__( 'GF Live Search', 'gf-live-search' ),
            esc_html__( '🐛 Report a Bug', 'gf-live-search' )
        );
    } else {
        $links[] = sprintf(
            '<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
            'https://github.com/guilamu/guilamu-bug-reporter/releases',
            esc_html__( '🐛 Report a Bug (install Bug Reporter)', 'gf-live-search' )
        );
    }

    return $links;
}, 10, 2 );
