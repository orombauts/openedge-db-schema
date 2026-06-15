import * as vscode from 'vscode';
import { SchemaManager, DbConnectionProfile } from './schemaManager';
import { log, logError } from './logger';

export type SchemaLoadResult = 'success' | 'not-ready' | 'error';

export async function getOpenEdgeSchema(
    ablExtension: vscode.Extension<any> | undefined,
    schemaManager: SchemaManager,
    dumpToFile: boolean,
    silent = false
): Promise<SchemaLoadResult> {
    try {
        if (!ablExtension) {
            if (!silent) { vscode.window.showErrorMessage('OpenEdge ABL extension not found. Is it installed?'); }
            return 'error';
        }

        if (!ablExtension.isActive) {
            if (!silent) { vscode.window.showWarningMessage('OpenEdge ABL extension is not active yet. Please open an ABL file first.'); }
            return 'not-ready';
        }

        // Check what's exported
        log('Extension exports:', ablExtension.exports);

        // Check if exports object exists
        if (!ablExtension.exports) {
            if (!silent) { vscode.window.showErrorMessage('OpenEdge ABL extension does not export any API'); }
            return 'error';
        }

        // Check if getSchema function exists
        if (typeof ablExtension.exports.getSchema !== 'function') {
            const methods = Object.keys(ablExtension.exports).filter(key =>
                typeof ablExtension.exports[key] === 'function'
            );
            log('Available methods:', methods);
            if (!silent) {
                vscode.window.showErrorMessage(
                    `getSchema method not found. Available methods: ${methods.length > 0 ? methods.join(', ') : 'none'}`
                );
            }
            return 'error';
        }

        // Get the workspace folder URI
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            if (!silent) { vscode.window.showErrorMessage('No workspace folder open'); }
            return 'error';
        }

        try {
            const schema = await ablExtension.exports.getSchema(workspaceFolder.uri.toString());

            if (!schema) {
                if (!silent) { vscode.window.showErrorMessage('getSchema returned null or undefined'); }
                return 'not-ready';
            }

            if (typeof schema !== 'object' || !schema.databases) {
                if (!silent) { vscode.window.showErrorMessage('getSchema returned invalid schema structure (missing databases property)'); }
                log('Invalid schema structure:', schema);
                return 'not-ready';
            }

            // Store schema in manager, applying any dbConnectionProfiles view collapsing.
            schemaManager.setSchema(applyProfileCollapsing(schema, workspaceFolder));

            if (dumpToFile) {
                // Create the output directory
                const outputDir = vscode.Uri.joinPath(workspaceFolder.uri, '.openedge-db-schema');
                await vscode.workspace.fs.createDirectory(outputDir);

                // Write schema to file
                const schemaFile = vscode.Uri.joinPath(outputDir, 'schema.json');
                const schemaContent = JSON.stringify(schema, null, 2);
                await vscode.workspace.fs.writeFile(schemaFile, Buffer.from(schemaContent, 'utf8'));

                // Open the file
                const doc = await vscode.workspace.openTextDocument(schemaFile);
                await vscode.window.showTextDocument(doc);
            }

            return 'success';
        } catch (getSchemaError) {
            logError('Error calling getSchema:', getSchemaError);
            if (!silent) { vscode.window.showErrorMessage(`Failed to call getSchema: ${getSchemaError}`); }
            return 'error';
        }
    } catch (error) {
        logError('Error getting schema:', error);
        if (!silent) { vscode.window.showErrorMessage(`Error: ${error}`); }
        return 'error';
    }
}

/**
 * Applies dbConnectionProfiles view collapsing to the raw schema returned by the
 * ABL LSP.  Any profile that has a `connectParts` array causes the listed database
 * entries to be hidden from the tree and replaced by a single synthetic node named
 * after the profile's `database` property.  Profiles without `connectParts` are
 * ignored here (they only affect connection building at fetch time).
 */
function applyProfileCollapsing(
    schema: { databases: { name: string; tables: any[] }[] },
    workspaceFolder: vscode.WorkspaceFolder,
): { databases: { name: string; tables: any[] }[] } {
    const profiles = vscode.workspace
        .getConfiguration('openedge-db-schema', workspaceFolder.uri)
        .get<DbConnectionProfile[]>('records.dbConnectionProfiles', []);

    const composedProfiles = profiles.filter(p => p.connectParts && p.connectParts.length > 0);
    if (composedProfiles.length === 0) {
        return schema;
    }

    const absorbedNames = new Set(composedProfiles.flatMap(p => p.connectParts!));

    // Keep databases that are not absorbed by any profile.
    const remaining = schema.databases.filter(db => !absorbedNames.has(db.name));

    // Inject one synthetic node per composed profile, using the table list of the
    // first connectParts member that is present in the schema.
    for (const profile of composedProfiles) {
        const source = schema.databases.find(db => profile.connectParts!.includes(db.name));
        if (source) {
            remaining.push({ name: profile.database, tables: source.tables });
        } else {
            log(`dbConnectionProfiles: no schema entry found for connectParts of profile "${profile.database}" — profile node will not appear.`);
        }
    }

    return { ...schema, databases: remaining };
}
