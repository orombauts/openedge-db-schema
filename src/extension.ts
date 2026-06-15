import * as vscode from 'vscode';
import { SchemaWebviewProvider } from './schemaWebviewProvider';
import { SchemaManager } from './schemaManager';
import { getOpenEdgeSchema } from './schemaService';
import { RecordsWebviewPanel } from './recordsWebviewPanel';
import { log } from './logger';

const ABL_EXTENSION_ID = 'RiversideSoftware.openedge-abl-lsp';
const RETRY_DELAYS_MS = [3000, 5000, 10000, 15000, 30000]; // back-off schedule

export function activate(context: vscode.ExtensionContext) {
    log('OpenEdge DB Schema is now active');

    // Get the OpenEdge ABL extension
    let ablExtension = vscode.extensions.getExtension(ABL_EXTENSION_ID);

    if (!ablExtension) {
        log('OpenEdge ABL extension not found - commands will check at runtime');
    }

    // Create schema manager (model layer)
    const schemaManager = new SchemaManager();

    // ── Auto-load with retry ──────────────────────────────────────────────────
    let retryIndex = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleRetry = (autoLoadFn: () => Promise<void>) => {
        if (retryIndex >= RETRY_DELAYS_MS.length) {
            log('Auto-load: max retries reached, giving up.');
            return;
        }
        const delay = RETRY_DELAYS_MS[retryIndex++];
        log(`Auto-load: retrying in ${delay}ms (attempt ${retryIndex}/${RETRY_DELAYS_MS.length})`);
        retryTimer = setTimeout(autoLoadFn, delay);
    };

    const autoLoad = async () => {
        if (schemaManager.getSchema()) { return; } // already loaded

        schemaWebviewProvider.showLoading();
        const result = await getOpenEdgeSchema(ablExtension, schemaManager, false, true /*silent*/);

        if (result === 'success') {
            retryIndex = 0; // reset for future reloads
        } else if (result === 'not-ready') {
            scheduleRetry(autoLoad);
        }
        // 'error' (hard failure) → stop silently; manual refresh still works
    };

    // Re-acquire the extension reference and trigger auto-load when it activates
    const extensionChangeDisposable = vscode.extensions.onDidChange(() => {
        ablExtension = vscode.extensions.getExtension(ABL_EXTENSION_ID);
        if (ablExtension?.isActive && !schemaManager.getSchema()) {
            if (retryTimer) { clearTimeout(retryTimer); retryTimer = undefined; }
            retryIndex = 0;
            autoLoad();
        }
    });
    context.subscriptions.push(extensionChangeDisposable);
    // ─────────────────────────────────────────────────────────────────────────

    // Create webview provider (view layer)
    const schemaWebviewProvider = new SchemaWebviewProvider(context.extensionUri, schemaManager, autoLoad);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SchemaWebviewProvider.viewType,
            schemaWebviewProvider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
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

    // Register command to open the records grid panel for a given database + table
    let recordsGridDisposable = vscode.commands.registerCommand(
        'openedge-db-schema.openRecordsGrid',
        (args: { databaseName: string; tableName: string }) => {
            if (!args?.tableName) {
                vscode.window.showErrorMessage('openRecordsGrid: tableName is required.');
                return;
            }
            RecordsWebviewPanel.open(
                context.extensionUri,
                args.databaseName ?? '',
                args.tableName,
            );
        },
    );

    context.subscriptions.push(disposable, refreshDisposable, dumpDisposable, recordsGridDisposable, schemaManager, {
        dispose: () => { if (retryTimer) { clearTimeout(retryTimer); } }
    });
}

export function deactivate() {}
