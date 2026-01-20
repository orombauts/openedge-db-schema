import * as vscode from 'vscode';
import { SchemaWebviewProvider } from './schemaWebviewProvider';
import { SchemaManager } from './schemaManager';
import { getOpenEdgeSchema } from './schemaService';
import { log } from './logger';

export function activate(context: vscode.ExtensionContext) {
    log('OpenEdge DB Schema is now active');

    // Get the OpenEdge ABL extension
    const ablExtension = vscode.extensions.getExtension('RiversideSoftware.openedge-abl-lsp');
    
    if (!ablExtension) {
        log('OpenEdge ABL extension not found - commands will check at runtime');
    }

    // Create schema manager (model layer)
    const schemaManager = new SchemaManager();

    // Create webview provider (view layer)
    const schemaWebviewProvider = new SchemaWebviewProvider(context.extensionUri, schemaManager);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SchemaWebviewProvider.viewType,
            schemaWebviewProvider
        )
    );

    // Register command to get schema
    let disposable = vscode.commands.registerCommand('openedge-db-schema.getSchema', async () => {
        schemaWebviewProvider.showLoading();
        await getOpenEdgeSchema(ablExtension, schemaManager, false);
    });

    // Register refresh command
    let refreshDisposable = vscode.commands.registerCommand('openedge-db-schema.refreshSchema', async () => {
        schemaWebviewProvider.showLoading();
        await getOpenEdgeSchema(ablExtension, schemaManager, false);
    });

    // Register dump command (gets schema and saves to file)
    let dumpDisposable = vscode.commands.registerCommand('openedge-db-schema.dumpSchema', async () => {
        schemaWebviewProvider.showLoading();
        await getOpenEdgeSchema(ablExtension, schemaManager, true);
    });

    context.subscriptions.push(disposable, refreshDisposable, dumpDisposable, schemaManager);
}

export function deactivate() {}
