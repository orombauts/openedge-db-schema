import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

interface FetchParams {
    tableName: string;
    databaseName: string;
    whereClause: string;
    limit: number;
    offset: number;
}

interface RecordsResult {
    columns?: { name: string; type: string }[];
    rows?: string[][];
    totalFetched?: number;
    hasMore?: boolean;
    offset?: number;
    limit?: number;
    error?: string;
}

export class RecordsWebviewPanel {
    public static readonly viewType = 'openedge-db-schema.recordsGrid';
    private static readonly _panels = new Map<string, RecordsWebviewPanel>();

    private readonly _panel: vscode.WebviewPanel;
    private readonly _disposables: vscode.Disposable[] = [];

    /** Open or reveal the records panel for a given database.table. */
    public static open(
        extensionUri: vscode.Uri,
        databaseName: string,
        tableName: string,
    ): void {
        const key = `${databaseName}.${tableName}`;
        const existing = RecordsWebviewPanel._panels.get(key);
        if (existing) {
            existing._panel.reveal(vscode.ViewColumn.One);
            return;
        }
        new RecordsWebviewPanel(extensionUri, databaseName, tableName, key);
    }

    private constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _databaseName: string,
        private readonly _tableName: string,
        key: string,
    ) {
        this._panel = vscode.window.createWebviewPanel(
            RecordsWebviewPanel.viewType,
            `${_databaseName}.${_tableName} — Records`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [_extensionUri],
                retainContextWhenHidden: true,
            },
        );

        this._panel.webview.html = this._getHtml();

        this._panel.webview.onDidReceiveMessage(
            (msg) => this._handleMessage(msg),
            null,
            this._disposables,
        );

        this._panel.onDidDispose(() => this._dispose(key), null, this._disposables);

        RecordsWebviewPanel._panels.set(key, this);
    }

    // ── Inbound message handling ────────────────────────────────────────

    private async _handleMessage(msg: any): Promise<void> {
        if (msg.type === 'fetchRecords') {
            await this._fetchRecords({
                tableName:   msg.tableName   ?? this._tableName,
                databaseName: msg.databaseName ?? this._databaseName,
                whereClause: msg.whereClause ?? '',
                limit:       Number(msg.limit)  || 100,
                offset:      Number(msg.offset) || 0,
            });
        }
    }

    // ── ABL execution ───────────────────────────────────────────────────

    private async _fetchRecords(params: FetchParams): Promise<void> {
        this._send({ type: 'loading' });

        let ablExe: string;
        let connectArgs: string[];
        try {
            ({ ablExe, connectArgs } = this._resolveAblEnvironment());
        } catch (err: any) {
            return this._sendError(err.message);
        }

        const stamp      = Date.now();
        const paramsFile = path.join(os.tmpdir(), `oe_params_${stamp}.txt`);
        const outputFile = path.join(os.tmpdir(), `oe_result_${stamp}.json`);

        try {
            // Parameters file: one value per line (table, where, limit, offset, outputFile, converterProc)
            const converterProc = vscode.workspace
                .getConfiguration('openedge-db-schema')
                .get<string>('records.converterProcedure', '').trim();

            const paramsContent = [
                params.tableName,
                params.whereClause,
                String(params.limit),
                String(params.offset),
                outputFile,
                converterProc,
            ].join('\n') + '\n';

            fs.writeFileSync(paramsFile, paramsContent, 'utf8');

            const procPath = path.join(this._extensionUri.fsPath, 'resources', 'abl', 'fetch_table_records.p');
            const args     = [...connectArgs, '-b', '-p', procPath, '-param', paramsFile];
            const { exitCode, stdout, stderr } = await this._spawnAbl(ablExe, args);

            if (!fs.existsSync(outputFile)) {
                const detail = stdout || stderr || '(no output)';
                return this._sendError(
                    `ABL process exited with code ${exitCode}.\n\nCommand: ${ablExe} ${args.join(' ')}\n\nOutput:\n${detail}`,
                );
            }

            const raw: RecordsResult = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
            this._send({ type: 'recordsData', data: raw });

        } catch (err: any) {
            this._sendError(err.message ?? String(err));
        } finally {
            this._cleanup(paramsFile, outputFile);
        }
    }

    /**
     * Derives the ABL batch executable and database path from the openedge-abl-lsp
     * extension settings and the workspace openedge-project.json — no extra settings needed.
     */
    private _resolveAblEnvironment(): { ablExe: string; connectArgs: string[] } {
        // ── Executable from abl.configuration.runtimes ──────────────────
        const ablConfig      = vscode.workspace.getConfiguration('abl');
        const runtimes       = ablConfig.get<{ name: string; path: string }[]>('configuration.runtimes') ?? [];
        const defaultRuntime = (ablConfig.get<string>('configuration.defaultRuntime') ?? '').trim();
        const runtime        = runtimes.find(r => r.name === defaultRuntime) ?? runtimes[0];

        if (!runtime?.path) {
            throw new Error(
                'No OpenEdge runtime configured.\n' +
                'Add at least one entry to "abl.configuration.runtimes" in VS Code settings.',
            );
        }

        const exeName = process.platform === 'win32' ? '_progres.exe' : '_progres';
        const ablExe  = path.join(runtime.path, 'bin', exeName);

        // ── Database from openedge-project.json in workspace root ────────
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        const projectFile   = path.join(workspaceRoot, 'openedge-project.json');

        if (!fs.existsSync(projectFile)) {
            throw new Error(
                'openedge-project.json not found in workspace root.\n' +
                'This file is required by the OpenEdge ABL extension.',
            );
        }

        const project     = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
        const connections = project.dbConnections as { connect?: string; name?: string }[] | undefined;

        if (!connections?.length) {
            throw new Error(
                'No dbConnections found in openedge-project.json.\n' +
                'Add at least one database connection to run record queries.',
            );
        }

        // Pick the connection that matches the requested database name, or the first one.
        const conn = connections.find(c => c.name === this._databaseName) ?? connections[0];
        if (!conn.connect) {
            throw new Error(`Connection for "${this._databaseName}" has no connect string.`);
        }

        // Split the full connect string into args, resolving relative -db paths.
        const tokens      = conn.connect.trim().split(/\s+/);
        const connectArgs = tokens.map((tok, i) =>
            i > 0 && tokens[i - 1] === '-db' && !path.isAbsolute(tok)
                ? path.resolve(workspaceRoot, tok)
                : tok
        );

        return { ablExe, connectArgs };
    }

    private _spawnAbl(exe: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
        return new Promise((resolve) => {
            const proc = spawn(exe, args, { shell: false });
            let stdout = '';
            let stderr = '';
            proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
            proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
            proc.on('close', (code) => resolve({ exitCode: code ?? 1, stdout, stderr }));
            proc.on('error', (err) => resolve({ exitCode: 1, stdout: '', stderr: err.message }));
        });
    }

    private _cleanup(...files: string[]): void {
        for (const f of files) {
            try { if (fs.existsSync(f)) { fs.unlinkSync(f); } } catch { /* ignore */ }
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    private _send(payload: object): void {
        this._panel.webview.postMessage(payload);
    }

    private _sendError(message: string): void {
        this._send({ type: 'recordsData', data: { error: message } });
    }

    private _getHtml(): string {
        const nonce   = getNonce();
        const htmlPath = path.join(this._extensionUri.fsPath, 'resources', 'recordsWebview.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/\{\{nonce\}\}/g,        nonce);
        html = html.replace(/\{\{cspSource\}\}/g,    this._panel.webview.cspSource);
        html = html.replace(/\{\{tableName\}\}/g,    this._tableName);
        html = html.replace(/\{\{databaseName\}\}/g, this._databaseName);
        return html;
    }

    private _dispose(key: string): void {
        RecordsWebviewPanel._panels.delete(key);
        this._disposables.forEach((d) => d.dispose());
    }
}

function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
