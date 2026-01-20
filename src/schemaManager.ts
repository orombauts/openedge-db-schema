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

interface Index {
    name: string;
    primary: boolean;
    unique: boolean;
    fields: string[];
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
