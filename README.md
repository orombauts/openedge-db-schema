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

## Development

1. Install dependencies: `npm install`
2. Compile: `npm run compile`
3. Press F5 to launch extension in debug mode
4. In the launch.json, specify a test workspace path if needed

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes
