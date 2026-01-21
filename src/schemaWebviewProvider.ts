import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SchemaManager, SchemaData } from './schemaManager';

export class SchemaWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'openedge-db-schema.schemaView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _schemaManager: SchemaManager
    ) {
        // Listen for schema changes and update view
        _schemaManager.onSchemaChanged(data => {
            if (this._view) {
                this._view.webview.postMessage({ type: 'schemaData', data });
            }
        });
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'ready':
                    const schemaData = this._schemaManager.getSchema();
                    if (schemaData) {
                        webviewView.webview.postMessage({ type: 'schemaData', data: schemaData });
                    }
                    break;
                case 'copyNode':
                    this._handleCopyNode(data);
                    break;
                case 'refresh':
                    vscode.commands.executeCommand('openedge-db-schema.refreshSchema');
                    break;
                case 'save':
                    vscode.commands.executeCommand('openedge-db-schema.dumpSchema');
                    break;
            }
        });

        // Send schema data if already loaded
        const schemaData = this._schemaManager.getSchema();
        if (schemaData) {
            // Delay to ensure webview is fully initialized
            setTimeout(() => {
                webviewView.webview.postMessage({ type: 'schemaData', data: schemaData });
            }, 100);
        }
    }

    public showLoading(): void {
        if (this._view) {
            this._view.webview.postMessage({ type: 'loading' });
        }
    }

    private _handleCopyNode(data: { nodeType: string; databaseName: string; tableName?: string }): void {
        const schema = this._schemaManager.getSchema();
        if (!schema) {
            return;
        }

        let jsonOutput: any;

        if (data.nodeType === 'database') {
            // Find the database
            const database = schema.databases.find(db => db.name === data.databaseName);
            if (database) {
                jsonOutput = { databases: [database] };
            }
        } else if (data.nodeType === 'table' && data.tableName) {
            // Find the database and table
            const database = schema.databases.find(db => db.name === data.databaseName);
            if (database) {
                const table = database.tables.find(t => t.name === data.tableName);
                if (table) {
                    jsonOutput = {
                        databases: [{
                            name: database.name,
                            tables: [table]
                        }]
                    };
                }
            }
        }

        if (jsonOutput) {
            const jsonString = JSON.stringify(jsonOutput, null, 2);
            vscode.env.clipboard.writeText(jsonString);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();
        const codiconUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'codicons', 'codicon.css')
        );
        
        // Load HTML template
        const htmlPath = path.join(this._extensionUri.fsPath, 'resources', 'webview.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        // Inject dynamic values
        html = html.replace(/\{\{nonce\}\}/g, nonce);
        html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
        html = html.replace(/\{\{codiconUri\}\}/g, codiconUri.toString());
        
        return html;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
