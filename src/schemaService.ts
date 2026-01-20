import * as vscode from 'vscode';
import { SchemaManager } from './schemaManager';
import { log, logError } from './logger';

export async function getOpenEdgeSchema(
    ablExtension: vscode.Extension<any> | undefined,
    schemaManager: SchemaManager,
    dumpToFile: boolean
) {
    try {
        if (!ablExtension) {
            vscode.window.showErrorMessage('OpenEdge ABL extension not found. Is it installed?');
            return;
        }

        if (!ablExtension.isActive) {
            vscode.window.showWarningMessage('OpenEdge ABL extension is not active yet. Please open an ABL file first.');
            return;
        }

        // Check what's exported
        log('Extension exports:', ablExtension.exports);
        
        // Check if exports object exists
        if (!ablExtension.exports) {
            vscode.window.showErrorMessage('OpenEdge ABL extension does not export any API');
            return;
        }

        // Check if getSchema function exists
        if (typeof ablExtension.exports.getSchema !== 'function') {
            const methods = Object.keys(ablExtension.exports).filter(key => 
                typeof ablExtension.exports[key] === 'function'
            );
            log('Available methods:', methods);
            vscode.window.showErrorMessage(
                `getSchema method not found. Available methods: ${methods.length > 0 ? methods.join(', ') : 'none'}`
            );
            return;
        }

        // Get the workspace folder URI
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        
        try {
            const schema = await ablExtension.exports.getSchema(workspaceFolder.uri.toString());
            
            if (!schema) {
                vscode.window.showErrorMessage('getSchema returned null or undefined');
                return;
            }

            if (typeof schema !== 'object' || !schema.databases) {
                vscode.window.showErrorMessage('getSchema returned invalid schema structure (missing databases property)');
                log('Invalid schema structure:', schema);
                return;
            }
            
            // Store schema in manager
            schemaManager.setSchema(schema);
            
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
        } catch (getSchemaError) {
            logError('Error calling getSchema:', getSchemaError);
            vscode.window.showErrorMessage(`Failed to call getSchema: ${getSchemaError}`);
        }
    } catch (error) {
        logError('Error getting schema:', error);
        vscode.window.showErrorMessage(`Error: ${error}`);
    }
}
