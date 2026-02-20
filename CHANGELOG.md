# Changelog

## [1.2.0] - 2026-02-20

### Added
- Improvements on Search:
    - Matching text is highlighted in the tree view
    - If the search matches a table name, the table node now offers it child nodes to be viewed when expanding the table node
- Node texts of databases, tables, fields and indexes are now selectable, allowing them to copy via ctrl-C
- Context menu now has two options to copy: Copy name and Copy JSON". The latter is applicable to the database or table node (as before)

### Fixed
- Search: Nodes now only auto-expand when their *children* match; a node whose own name matches starts collapsed and can be manually expanded

## [1.1.0] - 2026-01-21

### Added
- Support sorting on fields and indexes
- Keep controls visible on scrolling the view

### Fixed
- Fixed link to OpenEdge ABL extension in readme file

## [1.0.4] - 2026-01-20

### Fixed
- Fixed webview content being lost when switching to another view and back
- Added `retainContextWhenHidden` option to preserve webview state

## [1.0.3] - 2026-01-20

### Fixed
- Fixed missing icons in webview when extension is installed from marketplace
- Bundled codicons font files directly into resources directory instead of relying on node_modules

## [1.0.2] - 2026-01-20

### Fixed
- Attempted fix for missing icons (unsuccessful - codicons not properly included)

## [1.0.1] - 2026-01-20

### Added
- Initial release
- Interactive database schema viewer in Explorer sidebar
- Search functionality with case-sensitive and wildcard options
- Copy database/table definitions to clipboard as JSON
- Refresh and dump schema features
- Support for OpenEdge ABL extension integration

## [1.0.0] - 2026-01-20

### Added
- Initial development version
