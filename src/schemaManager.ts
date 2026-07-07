import * as vscode from 'vscode';

interface SchemaData {
    databases: Database[];
}

interface Database {
    name: string;
    tables: Table[];
}

interface Table {
    name: string;
    fields: Field[];
    indexes: Index[];
}

interface Field {
    name: string;
    dataType: string;
    extent: number;
    label?: string;
    columnLabel?: string;
    format?: string;
    initial?: string;
}

interface IndexSegment {
    // The ABL LSP now returns index segments as objects. Different LSP
    // versions have used slightly different property names, so accept any of
    // these to identify the field.
    name?: string;
    field?: string;
    fieldName?: string;
    ascending?: boolean;
    descending?: boolean;
    abbreviated?: boolean;
}

interface Index {
    name: string;
    primary: boolean;
    unique: boolean;
    // Older LSP versions returned plain strings; newer versions return
    // IndexSegment objects.
    fields: (string | IndexSegment)[];
}

export interface DbConnectionProfile {
    database: string;
    pf?: string;
    connectString?: string;
    connectParts?: string[];
    extraArgs?: string;
}

export { SchemaData, Database, Table, Field, Index };

export class SchemaManager {
    private schemaData: SchemaData | null = null;
    private onSchemaChangedEmitter = new vscode.EventEmitter<SchemaData>();
    public readonly onSchemaChanged = this.onSchemaChangedEmitter.event;

    public setSchema(data: SchemaData): void {
        this.schemaData = data;
        this.onSchemaChangedEmitter.fire(data);
    }

    public getSchema(): SchemaData | null {
        return this.schemaData;
    }

    public dispose(): void {
        this.onSchemaChangedEmitter.dispose();
    }
}
