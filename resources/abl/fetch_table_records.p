/*------------------------------------------------------------------------
  fetch_table_records.p
  OpenEdge batch procedure: dynamically fetches records from a table and
  writes the result as a JSON file.

  Invocation (batch mode):
    _progres <db> -b -p fetch_table_records.p -param "<paramsFile>"

  <paramsFile> is a plain-text file with one value per line:
    Line 1 : table name
    Line 2 : WHERE clause (may be blank)
    Line 3 : limit (integer, default 100)
    Line 4 : offset (integer, default 0)
    Line 5 : absolute path for the JSON output file
    Line 6 : (optional) path to a converter procedure with signature:
               INPUT p_table AS CHARACTER
               INPUT p_column AS CHARACTER
               INPUT p_datatype AS CHARACTER
               INPUT p_value AS CHARACTER
               OUTPUT p_result AS CHARACTER
------------------------------------------------------------------------*/

DEFINE VARIABLE ParamsFile AS CHARACTER NO-UNDO.
DEFINE VARIABLE TableName AS CHARACTER NO-UNDO.
DEFINE VARIABLE WhereClause AS CHARACTER NO-UNDO.
DEFINE VARIABLE LimitString AS CHARACTER NO-UNDO.
DEFINE VARIABLE OffsetString AS CHARACTER NO-UNDO.
DEFINE VARIABLE OutputFile AS CHARACTER NO-UNDO.
DEFINE VARIABLE Limit AS INTEGER NO-UNDO INITIAL 100.
DEFINE VARIABLE Offset AS INTEGER NO-UNDO INITIAL 0.
DEFINE VARIABLE BufferHandle AS HANDLE NO-UNDO.
DEFINE VARIABLE QueryHandle AS HANDLE NO-UNDO.
DEFINE VARIABLE QueryString AS CHARACTER NO-UNDO.
DEFINE VARIABLE Json AS LONGCHAR NO-UNDO.
DEFINE VARIABLE ColumnData AS CHARACTER NO-UNDO.
DEFINE VARIABLE Row AS CHARACTER NO-UNDO.
DEFINE VARIABLE FieldVal AS CHARACTER NO-UNDO.
DEFINE VARIABLE Count AS INTEGER NO-UNDO INITIAL 0.
DEFINE VARIABLE FieldIndex AS INTEGER NO-UNDO.
DEFINE VARIABLE SkipIndex AS INTEGER NO-UNDO.
DEFINE VARIABLE IsFirst AS LOGICAL NO-UNDO INITIAL TRUE.
DEFINE VARIABLE IsUnknown AS LOGICAL NO-UNDO.
DEFINE VARIABLE QuoteChar AS CHARACTER NO-UNDO INITIAL "~"":U.
DEFINE VARIABLE OpenBrace AS CHARACTER NO-UNDO INITIAL "~{":U.
DEFINE VARIABLE CloseBrace AS CHARACTER NO-UNDO INITIAL "~}":U.
DEFINE VARIABLE CarriageReturn AS CHARACTER NO-UNDO INITIAL "~r":U.
DEFINE VARIABLE NewLine AS CHARACTER NO-UNDO INITIAL "~n":U.
DEFINE VARIABLE Backspace AS CHARACTER NO-UNDO INITIAL "~b":U.
DEFINE VARIABLE HorizontalTab AS CHARACTER NO-UNDO INITIAL "~t":U.
DEFINE VARIABLE Formfeed AS CHARACTER NO-UNDO INITIAL "~f":U.
DEFINE VARIABLE Backslash AS CHARACTER NO-UNDO INITIAL "~\":U.
DEFINE VARIABLE ConverterProc AS CHARACTER NO-UNDO.

/* --------------------------------------------------------------------- */

/* Read parameters file */
ASSIGN ParamsFile = TRIM(SESSION:PARAMETER).

INPUT FROM VALUE(ParamsFile).
IMPORT UNFORMATTED TableName NO-ERROR.
IF ERROR-STATUS:ERROR THEN ASSIGN TableName = "":U.
IMPORT UNFORMATTED WhereClause NO-ERROR.
IF ERROR-STATUS:ERROR THEN ASSIGN WhereClause = "":U.
IMPORT UNFORMATTED LimitString NO-ERROR.
IF ERROR-STATUS:ERROR THEN ASSIGN LimitString = "":U.
IMPORT UNFORMATTED OffsetString NO-ERROR.
IF ERROR-STATUS:ERROR THEN ASSIGN OffsetString = "":U.
IMPORT UNFORMATTED OutputFile NO-ERROR.
IF ERROR-STATUS:ERROR THEN ASSIGN OutputFile = "":U.
IMPORT UNFORMATTED ConverterProc NO-ERROR.
IF ERROR-STATUS:ERROR THEN ASSIGN ConverterProc = "":U.

INPUT CLOSE.

/* Convert limit and offset to integers */
ASSIGN Limit = INTEGER(LimitString) NO-ERROR.
IF Limit = ? OR Limit <= 0 THEN ASSIGN Limit = 100.

ASSIGN Offset = INTEGER(OffsetString) NO-ERROR.
IF Offset = ? OR Offset < 0 THEN ASSIGN Offset = 0.

/* Validate table name */
IF TRIM(TableName) = "":U
THEN DO:
    RUN WriteError("Table name is required.":U).
    RETURN.
END.

CREATE BUFFER BufferHandle FOR TABLE TableName NO-ERROR.
IF NOT VALID-HANDLE(BufferHandle)
THEN DO:
    RUN WriteError("Invalid table: ":U + TableName).
    RETURN.
END.

/* Build column metadata */
ASSIGN ColumnData = "[":U.
DO FieldIndex = 1 TO BufferHandle:NUM-FIELDS:
    IF FieldIndex > 1 THEN ASSIGN ColumnData = ColumnData + ",":U.
    ASSIGN ColumnData = ColumnData
        + OpenBrace + QuoteChar + "name":U + QuoteChar + ":":U + QuoteChar + BufferHandle:BUFFER-FIELD(FieldIndex):NAME + QuoteChar
        + ",":U + QuoteChar + "type":U + QuoteChar + ":":U + QuoteChar + BufferHandle:BUFFER-FIELD(FieldIndex):DATA-TYPE + QuoteChar
        + CloseBrace.
END.
ASSIGN ColumnData = ColumnData + "]":U.

/* Prepare and open dynamic query */
CREATE QUERY QueryHandle.
QueryHandle:SET-BUFFERS(BufferHandle).

ASSIGN QueryString = "FOR EACH ":U + TableName + " NO-LOCK":U.
IF TRIM(WhereClause) <> "":U
THEN DO:
    ASSIGN QueryString = QueryString + " WHERE ":U + WhereClause.
END.

QueryHandle:QUERY-PREPARE(QueryString) NO-ERROR.
IF ERROR-STATUS:ERROR
THEN DO:
    RUN WriteError(ERROR-STATUS:GET-MESSAGE(1)).
    DELETE OBJECT QueryHandle NO-ERROR.
    DELETE OBJECT BufferHandle NO-ERROR.
    RETURN.
END.

QueryHandle:QUERY-OPEN() NO-ERROR.
IF ERROR-STATUS:ERROR
THEN DO:
    RUN WriteError(ERROR-STATUS:GET-MESSAGE(1)).
    DELETE OBJECT QueryHandle NO-ERROR.
    DELETE OBJECT BufferHandle NO-ERROR.
    RETURN.
END.

/* Skip offset rows */
DO SkipIndex = 1 TO Offset:
    QueryHandle:GET-NEXT() NO-ERROR.
    IF NOT BufferHandle:AVAILABLE THEN LEAVE.
END.

/* Collect rows into JSON */
ASSIGN
    Json = OpenBrace + QuoteChar + "columns":U + QuoteChar + ":":U + ColumnData + ",":U + QuoteChar + "rows":U + QuoteChar + ":[":U
    IsFirst = TRUE.

DO WHILE Count < Limit:
    QueryHandle:GET-NEXT() NO-ERROR.
    IF NOT BufferHandle:AVAILABLE THEN LEAVE.

    IF NOT IsFirst THEN ASSIGN Json = Json + ",".
    ASSIGN IsFirst = FALSE.

    ASSIGN Row = "[":U.
    DO FieldIndex = 1 TO BufferHandle:NUM-FIELDS:
        IF FieldIndex > 1 THEN ASSIGN Row = Row + ",":U.
        ASSIGN IsUnknown = FALSE.
        IF LOOKUP(BufferHandle:BUFFER-FIELD(FieldIndex):DATA-TYPE, "CLOB,BLOB":U) > 0
        THEN DO:
            ASSIGN FieldVal = "<":U + LC(BufferHandle:BUFFER-FIELD(FieldIndex):DATA-TYPE) + ">":U.
        END.
        ELSE DO:
            ASSIGN FieldVal = STRING(BufferHandle:BUFFER-FIELD(FieldIndex):BUFFER-VALUE) NO-ERROR.
            IF ERROR-STATUS:ERROR OR FieldVal = ?
            THEN DO:
                ASSIGN IsUnknown = TRUE.
            END.
        END.

        /* Optional column value converter */
        IF ConverterProc <> "":U
        THEN DO:
            RUN VALUE(ConverterProc)
                (TableName,
                 BufferHandle:BUFFER-FIELD(FieldIndex):NAME,
                 BufferHandle:BUFFER-FIELD(FieldIndex):DATA-TYPE,
                 FieldVal,
                 OUTPUT FieldVal) NO-ERROR.
            ASSIGN IsUnknown = ERROR-STATUS:ERROR.
            IF FieldVal = ? THEN ASSIGN IsUnknown = TRUE.
        END.
        /* Emit JSON null for unknown values, otherwise an escaped string */
        IF IsUnknown
        THEN DO:
            ASSIGN Row = Row + "null":U.
        END.
        ELSE DO:
            /* JSON string escaping */
            ASSIGN
                FieldVal = REPLACE(FieldVal, Backslash, Backslash + Backslash)
                FieldVal = REPLACE(FieldVal, QuoteChar, Backslash + QuoteChar)
                FieldVal = REPLACE(FieldVal, Backspace, Backslash + "b":U)
                FieldVal = REPLACE(FieldVal, HorizontalTab, Backslash + "t":U)
                FieldVal = REPLACE(FieldVal, NewLine, Backslash + "n":U)
                FieldVal = REPLACE(FieldVal, Formfeed, Backslash + "f":U)
                FieldVal = REPLACE(FieldVal, CarriageReturn, Backslash + "r":U)
                Row = Row + QuoteChar + FieldVal + QuoteChar.
        END.
    END.
    ASSIGN
        Row = Row + "]":U
        Json = Json + Row
        Count = Count + 1.
END.

/* Peek one more row to set hasMore */
QueryHandle:GET-NEXT() NO-ERROR.

ASSIGN Json = Json
    + "],":U
    + QuoteChar + "totalFetched":U + QuoteChar + ":":U + STRING(Count) + ",":U
    + QuoteChar + "hasMore":U + QuoteChar + ":":U + (IF BufferHandle:AVAILABLE THEN "true":U ELSE "false":U) + ",":U
    + QuoteChar + "offset":U + QuoteChar + ":":U + STRING(Offset) + ",":U
    + QuoteChar + "limit":U + QuoteChar + ":":U + STRING(Limit)
    + CloseBrace.

COPY-LOB FROM OBJECT Json TO FILE OutputFile NO-ERROR.
IF ERROR-STATUS:ERROR
THEN DO:
    RUN WriteError("Failed to write output: ":U + ERROR-STATUS:GET-MESSAGE(1)).
END.

DELETE OBJECT QueryHandle NO-ERROR.
DELETE OBJECT BufferHandle NO-ERROR.

/*****************************************************************************
Internal helper: write error JSON
*****************************************************************************/

PROCEDURE WriteError:

    DEFINE INPUT PARAMETER Msg AS CHARACTER NO-UNDO.

    DEFINE VARIABLE Escaped AS CHARACTER NO-UNDO.
    DEFINE VARIABLE OutStr AS CHARACTER NO-UNDO.

    /* --------------------------------------------------------------------- */

    ASSIGN
        Escaped = REPLACE(Msg, Backslash, Backslash + Backslash)
        Escaped = REPLACE(Escaped, QuoteChar, Backslash + QuoteChar)
        OutStr = OpenBrace + QuoteChar + "error":U + QuoteChar + ":":U + QuoteChar + Escaped + QuoteChar + CloseBrace.
    OUTPUT TO VALUE(OutputFile).
    PUT UNFORMATTED OutStr SKIP.
    OUTPUT CLOSE.

END PROCEDURE.
