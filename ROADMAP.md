# Possible future features

## Records grid

**1. Column sorting**
Click a column header to add `BY <field>` (or `BY <field> DESCENDING`) to the dynamic query. The ABL procedure already builds the query string dynamically, so appending `BY` is trivial there. The UI just needs a sort indicator in the header.

**2. Column visibility toggle**
A small "columns" button in the toolbar that opens a checklist of all fields. Hidden columns are excluded from the grid and from the TSV copy. Useful for wide tables with many uninteresting fields.

**3. Copy as JSON / CSV**
Alongside "Copy TSV", offer "Copy JSON" (array of objects, keys = column names) and "Copy CSV" (quoted, comma-separated). All three formats are purely client-side.

**4. Cell click → expand full value**
Cells are truncated to `max-width: 320px`. Clicking a cell could show the full raw value in a small tooltip overlay or a VS Code `showInformationMessage`. Especially useful for long CLOB placeholders or formatted strings.

**5. Resizable columns**
Standard drag-to-resize on `<th>` borders. Purely a CSS/JS addition, no backend change.

**6. Row count in status bar**
The ABL procedure currently does `GET-NEXT` one row at a time and stops at `Limit`. A separate `QueryHandle:QUERY-OFF-END` check after `QUERY-OPEN` could return the total matching row count cheaply (when the query is not too large), letting the status bar show "Rows 1–100 of 4,823" instead of "Rows 1–100+".

## Schema view

**7. Field detail on hover / click**
Clicking a field node in the schema tree could open a small detail panel (or show an inline tooltip) with its full metadata: data type, extent, label, column label, format string, initial value. Currently all of that is in the schema but only the name is shown.

**8. Index viewer**
Indexes are in the schema data but not surfaced in the view at all. A collapsible "Indexes" sub-node per table, listing each index with its fields, primary/unique flags, would be useful for query design.

**9. Schema search / filter**
A filter input at the top of the schema view to live-filter tables (and fields within them) by name substring. Useful for large schemas with hundreds of tables.

**10. Table record count badge**
When a table node is expanded (or on hover), fire a lightweight `COUNT(*)` query via a new minimal ABL procedure and show the result as a badge. Makes it immediately obvious which tables have data and which are empty.

## Connection / project

**11. Multi-workspace-folder support**
`schemaService.ts` currently uses `workspaceFolders?.[0]` everywhere. A workspace with multiple folders (e.g. `adm-abl-sources` and `adm-rest-abl-sources`) would only ever show the first folder's schema. The schema view could show one collapsible group per workspace folder, each with its own databases.

**12. Profile validation on settings save**
When `dbConnectionProfiles` is saved in settings, validate each `connectParts` entry against the current `openedge-project.json` and show a warning decoration on any name that doesn't resolve. Prevents silent misconfiguration.

## Export / integration

**13. Export records to file**
A "Save as…" button in the records grid toolbar that writes the current page (or all pages) to a `.json`, `.csv`, or `.tsv` file via `vscode.workspace.fs`. No ABL change needed beyond potentially re-running with a larger limit.

**14. "Open in new editor" for schema JSON**
The dump command already writes `schema.json`. A lightweight read-only virtual document provider could let you open a pretty-printed, syntax-highlighted schema view inline in the editor without writing a file to disk.
