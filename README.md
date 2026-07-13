# OpenEdge DB Schema

A VS Code extension to visualize and explore OpenEdge database schema in an interactive tree view with advanced search and copy features.

## Requirements

This extension requires the **OpenEdge ABL** extension to be installed and configured. The OpenEdge ABL extension provides the database schema information that this extension visualizes.

You can find the OpenEdge ABL extension in the VS Code Marketplace:
- Search for "OpenEdge ABL" in the Extensions view (Ctrl+Shift+X)
- Or visit: [OpenEdge ABL Extension](https://marketplace.visualstudio.com/items?itemName=RiversideSoftware.openedge-abl-lsp)

## Features

- Retrieve schema information from the OpenEdge ABL extension
- View database schema in an interactive tree with collapsible nodes
- **Integrated toolbar** with Refresh, Save, and Sort controls that stay visible while scrolling
- **Sort fields and indexes alphabetically** with toggle button (preserves original order when disabled)
- **Embedded search box** with case-sensitive and wildcard options
- **Search highlighting**: matching text is highlighted directly in the tree nodes
- Browse databases, tables, fields, and indexes hierarchically
- View detailed field information (extent, label, format, initial value)
- **Right-click context menu** on any node: copy the node name or copy database/table definitions as JSON
- **View table records**: right-click a table node and select "View Records" to open an interactive records grid with live data fetched from the database
- Loading indicator for schema refresh operations
- Save schema to `.openedge-db-schema/schema.json` in the workspace

## Usage

### Get Schema

1. Open Command Palette (Ctrl+Shift+P)
2. Run: `Get OpenEdge DB Schema`
3. The schema will be loaded into the interactive view

### Schema View

The **OpenEdge DB Schema** view appears in the Explorer sidebar and shows:
- **Databases**: Top-level database containers (hover for table count)
- **Tables**: Expandable table nodes (hover for field and index counts)
- **Fields**: Individual field nodes with data type and extent
  - Expand fields to see additional details: label, column label, format, initial value
- **Indexes**: Index definitions with primary/unique indicators
  - Expand indexes to see segment fields and their positions
  - Optionally, expand each index segment to see the underlying field's details (data type, extent, label, column label, format, initial value) — enable via [`openedge-db-schema.showFieldInfoOnIndexSegments`](#settings-reference)

### Search Features

The view includes a persistent search box with:
- **Search input**: Type to filter databases, tables, fields, and indexes in real-time
- **Search/Clear buttons**: Apply or clear the current filter
- **Case-sensitive toggle**: Match exact case in search
- **Wildcard toggle**: Enable wildcard patterns (`*` = any characters, `?` = single character)
- **Match highlighting**: Matched portions of text are highlighted in the tree
- **Smart auto-expand**: When a field or index name matches, its parent table is automatically expanded to reveal it. When a table or database name itself matches, the node is shown collapsed so you can explore its children at your own pace

### Toolbar

The fixed toolbar at the top of the view provides:
- **Refresh**: Reload the schema from the OpenEdge ABL extension
- **Save**: Save the current schema to a JSON file and open it
- **Sort**: Toggle alphabetical sorting for fields and indexes (maintains original order when disabled)

The toolbar remains visible while scrolling through the schema tree.

### Copy to Clipboard

Right-click on any database, table, field, or index node to access the context menu:
- **Copy name**: Copies the node's label text to the clipboard (available on all nodes)
- **Copy JSON**: Copies the full database or table definition as formatted JSON (available on database and table nodes only)

The JSON structure matches the OpenEdge ABL extension schema format, making it easy to share schema definitions.

### View Table Records

Right-click on a table node and select **View Records** to open the records panel:
- Fetches live data from the connected OpenEdge database using the ABL extension. If the default connection derived from `openedge-project.json` is not sufficient (e.g. a Progress MSSQL DataServer setup), see [Database Connection Profiles](#database-connection-profiles) below.
- Displays records in a paginated grid with column resizing
- Column names and data types are shown in the header (type on a second line to maximise visible columns)
- Unknown values (OpenEdge `?`) are shown as a muted italic `?`, distinct from an empty string
- **Multi-row selection**: use the checkbox column to select individual rows; hold **Shift** to select a range; use the header checkbox to select or deselect all rows on the current page
- **Copy TSV**: once rows are selected, the toolbar shows a **Copy TSV** button that copies the selected rows — including a column header row — as tab-separated values, ready to paste into a spreadsheet

#### Database Connection Profiles

The extension reads database connection details from `openedge-project.json` automatically. For cases where the default connection is insufficient — such as Progress MSSQL DataServer setups that require a schema holder and a DataServer connection to be started together, or connections that need credentials not stored in the project file — you can define named connection profiles in your VS Code settings:

```json
"openedge-db-schema.records.dbConnectionProfiles": [
    {
        "database": "mwdb",
        "connectParts": ["mwdb_sh", "mwdb"],
        "extraArgs": "-U <username> -P <password> -c 8196 -Dsrv SKIP_SCHEMA_CHECK"
    }
]
```

Each profile entry supports the following properties:

| Property | Description |
|---|---|
| `database` | Arbitrary display name for the profile. This is the name shown in the schema tree and used to open the records grid. |
| `connectParts` | Ordered list of `dbConnections` names from `openedge-project.json` whose connect strings are concatenated. **The schema holder must appear first.** |
| `extraArgs` | Additional raw connect flags appended after the expanded `connectParts`, e.g. credentials and tuning flags. Only used when `connectParts` is set. |
| `pf` | Absolute path to a `.pf` parameter file. Passed to `_progres` as `-pf <path>`. Takes precedence over `connectParts` and `connectString`. |
| `connectString` | Raw connect flags string. Used when neither `pf` nor `connectParts` is set. |

**View collapsing**: when a profile specifies `connectParts`, the referenced database entries are automatically hidden in the schema tree and replaced by a single node named after the profile's `database` value. This prevents duplicate entries when a Progress MSSQL DataServer schema holder (`mwdb_sh`) and its data-source connection (`mwdb`) both expose the same table catalog.

#### Custom Column Converter

You can provide an optional ABL procedure to transform column values before they are displayed. Set the path in your VS Code settings:

```json
"openedge-db-schema.records.converterProcedure": "path/to/your/converter.p"
```

The procedure must have the following signature:

```openedge
PROCEDURE converter:
    DEFINE INPUT  PARAMETER p_table    AS CHARACTER NO-UNDO.
    DEFINE INPUT  PARAMETER p_column   AS CHARACTER NO-UNDO.
    DEFINE INPUT  PARAMETER p_datatype AS CHARACTER NO-UNDO.
    DEFINE INPUT  PARAMETER p_value    AS CHARACTER NO-UNDO.
    DEFINE OUTPUT PARAMETER p_result   AS CHARACTER NO-UNDO.
END PROCEDURE.
```

When the setting is empty (default), values are displayed as-is.

## Development

1. Install dependencies: `npm install`
2. Compile: `npm run compile`
3. Press F5 to launch extension in debug mode
4. In the launch.json, specify a test workspace path if needed

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| `openedge-db-schema.autoLoadSchema` | `true` | Automatically load the database schema when the OpenEdge DB Schema view becomes active. Disable if you prefer to load the schema manually via the Refresh button. |
| `openedge-db-schema.showFieldInfoOnIndexSegments` | `false` | When enabled, index segments become expandable in the schema tree and reveal the underlying field's details (data type, extent, label, column label, format, initial). |
| `openedge-db-schema.records.converterProcedure` | _(empty)_ | Path to an optional ABL converter procedure. See [Custom Column Converter](#custom-column-converter). |
| `openedge-db-schema.records.dbConnectionProfiles` | `[]` | Named connection profiles for record fetching and schema tree collapsing. See [Database Connection Profiles](#database-connection-profiles). |

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes
