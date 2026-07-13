# Changelog

## [1.5.0] - 2026-07-13

### Added
- Schema tree: index segments can be expanded to reveal the underlying field's details (data type, extent, label, column label, format, initial value). Enabled by the new setting `openedge-db-schema.showFieldInfoOnIndexSegments` (default `false`)

### Changed
- Records grid: the **Clear** toolbar button no longer re-fetches records. It now empties the WHERE input and clears the grid state (rows, selection, pagination, status), and remains enabled at all times.

### Fixed
- Records grid: sticky column header no longer lets scrolled rows bleed through.

## [1.4.1] - 2026-07-07

### Fixed
- Schema tree: index segments are now displayed correctly, in sync with recently resolved issue in the OpenEdge ABL LSP API call that returns the schema information.

## [1.4.0] - 2026-06-15

### Added
- New `openedge-db-schema.records.dbConnectionProfiles` setting: a named connection profile array that controls both how `_progres` is connected when fetching table records and how the database is presented in the schema tree. Each profile supports three connection modes (in priority order):
  - `connectParts` + optional `extraArgs`: an ordered list of `dbConnections` entry names from `openedge-project.json` whose connect strings are concatenated to build the full connect arguments; `extraArgs` appends additional raw flags (e.g. credentials, tuning parameters). Designed for Progress MSSQL DataServer setups where a schema holder and a DataServer connection must both be started together.
  - `pf`: absolute path to a `.pf` parameter file, passed to `_progres` as `-pf <path>`
  - `connectString`: a raw connect flags string used as-is
- Schema view collapsing: when a profile uses `connectParts`, the referenced `dbConnections` entries are automatically hidden in the schema tree and replaced by a single node named after the profile's `database` value — eliminating the duplicate table listings that occur when a Progress MSSQL DataServer schema holder and its data-source connection both expose the same table catalog
- The profile's `database` name is a free-form display label; it does not need to match any entry in `openedge-project.json`
- Auto-load schema with exponential back-off retry on extension activation; retries automatically when the OpenEdge ABL extension activates late
- Auto-load re-triggers when the schema view becomes visible and no schema is loaded yet

### Fixed
- Records fetch: `-db` tokens that are logical DataServer names (e.g. `mwdb`) are no longer incorrectly resolved as filesystem paths — only tokens that contain a path separator or end with `.db` are resolved against the filesystem
- Records fetch: relative `-db` paths in `openedge-project.json` are now resolved relative to the directory containing that file, rather than `workspaceFolders[0]`


## [1.3.1] - 2026-03-23

### Fixed
- Records grid: fixed display issues caused by incorrect JSON string escaping in field values — now fully compliant with RFC 8259

## [1.3.0] - 2026-03-02

### Added
- Records grid: right-click a table node to open a panel showing its live records fetched from the database
- New `fetch_table_records.p` ABL procedure to query table data via the OpenEdge ABL extension
- Records panel with paginated grid and column resizing
- Optional `openedge-db-schema.records.converterProcedure` setting: path to a custom ABL procedure that converts column values when fetching records
- Unknown field values (OpenEdge `?`) are preserved as JSON `null` and displayed as a muted italic `?` in the grid, distinct from an empty string
- Multi-row selection in the records grid: checkbox column with select-all header, shift-click range select, and a **Copy TSV** toolbar button that copies selected rows (with column headers) to the clipboard
- Column data type shown on a second line in the header to allow more columns to fit in the view

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
