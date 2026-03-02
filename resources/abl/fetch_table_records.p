/*------------------------------------------------------------------------
  fetch_table_records.p
  OpenEdge batch procedure: dynamically fetches records from a table and
  writes the result as a JSON file.

  Invocation (batch mode):
    _progres <db> -b -p fetch_table_records.p -param "<paramsFile>"

  <paramsFile> is a plain-text file with one value per line:
    Line 1 : table name
    Line 2 : WHERE clause  (may be blank)
    Line 3 : limit  (integer, default 100)
    Line 4 : offset (integer, default 0)
    Line 5 : absolute path for the JSON output file
    Line 6 : (optional) path to a converter procedure with signature:
               INPUT  p_table    AS CHARACTER
               INPUT  p_column   AS CHARACTER
               INPUT  p_datatype AS CHARACTER
               INPUT  p_value    AS CHARACTER
               OUTPUT p_result   AS CHARACTER
------------------------------------------------------------------------*/

DEFINE VARIABLE cParamsFile AS CHARACTER NO-UNDO.
DEFINE VARIABLE cTable      AS CHARACTER NO-UNDO.
DEFINE VARIABLE cWhere      AS CHARACTER NO-UNDO.
DEFINE VARIABLE cLimitStr   AS CHARACTER NO-UNDO.
DEFINE VARIABLE cOffsetStr  AS CHARACTER NO-UNDO.
DEFINE VARIABLE cOutputFile AS CHARACTER NO-UNDO.
DEFINE VARIABLE iLimit      AS INTEGER   NO-UNDO INITIAL 100.
DEFINE VARIABLE iOffset     AS INTEGER   NO-UNDO INITIAL 0.
DEFINE VARIABLE hBuffer     AS HANDLE    NO-UNDO.
DEFINE VARIABLE hQuery      AS HANDLE    NO-UNDO.
DEFINE VARIABLE cQueryStr   AS CHARACTER NO-UNDO.
DEFINE VARIABLE cJson       AS LONGCHAR  NO-UNDO.
DEFINE VARIABLE cColumns    AS CHARACTER NO-UNDO.
DEFINE VARIABLE cRow        AS CHARACTER NO-UNDO.
DEFINE VARIABLE cFieldVal   AS CHARACTER NO-UNDO.
DEFINE VARIABLE iCount      AS INTEGER   NO-UNDO INITIAL 0.
DEFINE VARIABLE iField      AS INTEGER   NO-UNDO.
DEFINE VARIABLE iSkip       AS INTEGER   NO-UNDO.
DEFINE VARIABLE lFirst      AS LOGICAL   NO-UNDO INITIAL TRUE.
DEFINE VARIABLE lUnknown    AS LOGICAL   NO-UNDO.
DEFINE VARIABLE cQ             AS CHARACTER NO-UNDO.
DEFINE VARIABLE cOB            AS CHARACTER NO-UNDO. /* { */
DEFINE VARIABLE cCB            AS CHARACTER NO-UNDO. /* } */
DEFINE VARIABLE cConverterProc AS CHARACTER NO-UNDO.

DEFINE VARIABLE iParamPos   AS INTEGER   NO-UNDO.
DEFINE VARIABLE cAllParams  AS CHARACTER NO-UNDO.

/* ── Read parameters file ─────────────────────────────────────────── */
/* SESSION:STARTUP-PARAMETERS is the full startup string; extract the value after -param */
cAllParams  = SESSION:STARTUP-PARAMETERS.
iParamPos   = INDEX(cAllParams, "-param ":U).
IF iParamPos = 0 THEN DO:
    OUTPUT TO VALUE(cOutputFile).
    PUT UNFORMATTED "no -param argument found in startup parameters":U SKIP.
    OUTPUT CLOSE.
    RETURN.
END.
cParamsFile = SUBSTRING(cAllParams, iParamPos + 7).
/* trim at the next comma if the params string continues */
iParamPos = INDEX(cParamsFile, ",":U).
IF iParamPos > 0 THEN
    cParamsFile = SUBSTRING(cParamsFile, 1, iParamPos - 1).
cParamsFile = TRIM(cParamsFile).

cQ  = CHR(34).
cOB = CHR(123).
cCB = CHR(125).

INPUT FROM VALUE(cParamsFile).
IMPORT UNFORMATTED cTable.
IMPORT UNFORMATTED cWhere.
IMPORT UNFORMATTED cLimitStr.
IMPORT UNFORMATTED cOffsetStr.
IMPORT UNFORMATTED cOutputFile.
IMPORT UNFORMATTED cConverterProc NO-ERROR.
IF ERROR-STATUS:ERROR THEN cConverterProc = "":U.
INPUT CLOSE.

iLimit  = INTEGER(cLimitStr)  NO-ERROR.  IF iLimit  = ? OR iLimit  <= 0 THEN iLimit  = 100.
iOffset = INTEGER(cOffsetStr) NO-ERROR.  IF iOffset = ? OR iOffset <  0 THEN iOffset = 0.

/* ── Internal helper: write error JSON ───────────────────────────── */
PROCEDURE WriteError:
    DEFINE INPUT PARAMETER p_msg AS CHARACTER NO-UNDO.
    DEFINE VARIABLE cEsc AS CHARACTER NO-UNDO.
    DEFINE VARIABLE cOut AS CHARACTER NO-UNDO.
    cEsc = REPLACE(p_msg, CHR(92), CHR(92) + CHR(92)).
    cEsc = REPLACE(cEsc,  CHR(34), CHR(92) + CHR(34)).
    cOut = cOB + cQ + "error":U + cQ + ":":U + cQ + cEsc + cQ + cCB.
    OUTPUT TO VALUE(cOutputFile).
    PUT UNFORMATTED cOut SKIP.
    OUTPUT CLOSE.
END PROCEDURE.

/* ── Validate table name ─────────────────────────────────────────── */
IF TRIM(cTable) = "":U THEN DO:
    RUN WriteError("Table name is required.":U).
    RETURN.
END.

CREATE BUFFER hBuffer FOR TABLE cTable NO-ERROR.
IF NOT VALID-HANDLE(hBuffer) THEN DO:
    RUN WriteError("Invalid table: ":U + cTable).
    RETURN.
END.

/* ── Build column metadata ───────────────────────────────────────── */
cColumns = "[":U.
DO iField = 1 TO hBuffer:NUM-FIELDS:
    IF iField > 1 THEN cColumns = cColumns + ",":U.
    cColumns = cColumns
        + cOB + cQ + "name":U + cQ + ":":U + cQ + hBuffer:BUFFER-FIELD(iField):NAME     + cQ
        + ",":U  + cQ + "type":U + cQ + ":":U + cQ + hBuffer:BUFFER-FIELD(iField):DATA-TYPE + cQ
        + cCB.
END.
cColumns = cColumns + "]":U.

/* ── Prepare and open dynamic query ─────────────────────────────── */
CREATE QUERY hQuery.
hQuery:SET-BUFFERS(hBuffer).

cQueryStr = "FOR EACH ":U + cTable + " NO-LOCK":U.
IF TRIM(cWhere) <> "":U THEN
    cQueryStr = cQueryStr + " WHERE ":U + cWhere.

hQuery:QUERY-PREPARE(cQueryStr) NO-ERROR.
IF ERROR-STATUS:ERROR THEN DO:
    RUN WriteError(ERROR-STATUS:GET-MESSAGE(1)).
    DELETE OBJECT hQuery  NO-ERROR.
    DELETE OBJECT hBuffer NO-ERROR.
    RETURN.
END.

hQuery:QUERY-OPEN() NO-ERROR.
IF ERROR-STATUS:ERROR THEN DO:
    RUN WriteError(ERROR-STATUS:GET-MESSAGE(1)).
    DELETE OBJECT hQuery  NO-ERROR.
    DELETE OBJECT hBuffer NO-ERROR.
    RETURN.
END.

/* ── Skip offset rows ────────────────────────────────────────────── */
DO iSkip = 1 TO iOffset:
    hQuery:GET-NEXT() NO-ERROR.
    IF NOT hBuffer:AVAILABLE THEN LEAVE.
END.

/* ── Collect rows into JSON ──────────────────────────────────────── */
cJson  = cOB + cQ + "columns":U + cQ + ":":U + cColumns + ",":U + cQ + "rows":U + cQ + ":[":U.
lFirst = TRUE.

DO WHILE iCount < iLimit:
    hQuery:GET-NEXT() NO-ERROR.
    IF NOT hBuffer:AVAILABLE THEN LEAVE.

    IF NOT lFirst THEN cJson = cJson + ",".
    lFirst = FALSE.

    cRow = "[":U.
    DO iField = 1 TO hBuffer:NUM-FIELDS:
        IF iField > 1 THEN cRow = cRow + ",":U.
        lUnknown = FALSE.
        IF LOOKUP(hBuffer:BUFFER-FIELD(iField):DATA-TYPE, "CLOB,BLOB":U) > 0 THEN DO:
            cFieldVal = "<":U + LC(hBuffer:BUFFER-FIELD(iField):DATA-TYPE) + ">":U.
        END.
        ELSE DO:
            cFieldVal = STRING(hBuffer:BUFFER-FIELD(iField):BUFFER-VALUE) NO-ERROR.
            IF ERROR-STATUS:ERROR OR cFieldVal = ? THEN DO:
                lUnknown  = TRUE.
            END.
        END.
        /* Optional column value converter */
        IF cConverterProc <> "" THEN DO:
            RUN VALUE(cConverterProc)
                (INPUT  cTable,
                 INPUT  hBuffer:BUFFER-FIELD(iField):NAME,
                 INPUT  hBuffer:BUFFER-FIELD(iField):DATA-TYPE,
                 INPUT  cFieldVal,
                 OUTPUT cFieldVal) NO-ERROR.
            ASSIGN lUnknown = ERROR-STATUS:ERROR.
            IF cFieldVal = ? THEN lUnknown = TRUE.
        END.
        /* Emit JSON null for unknown values, otherwise an escaped string */
        IF lUnknown THEN DO:
            cRow = cRow + "null":U.
        END.
        ELSE DO:
            /* Minimal JSON string escaping */
            cFieldVal = REPLACE(cFieldVal, CHR(92), CHR(92) + CHR(92)).
            cFieldVal = REPLACE(cFieldVal, CHR(34), CHR(92) + CHR(34)).
            cFieldVal = REPLACE(cFieldVal, CHR(13), CHR(92) + "r":U).
            cFieldVal = REPLACE(cFieldVal, CHR(10), CHR(92) + "n":U).
            cRow = cRow + cQ + cFieldVal + cQ.
        END.
    END.
    cRow  = cRow + "]":U.
    cJson = cJson + cRow.
    iCount = iCount + 1.
END.

/* Peek one more row to set hasMore */
hQuery:GET-NEXT() NO-ERROR.

cJson = cJson
    + "],":U
    + cQ + "totalFetched":U + cQ + ":":U + STRING(iCount) + ",":U
    + cQ + "hasMore":U      + cQ + ":":U + (IF hBuffer:AVAILABLE THEN "true":U ELSE "false":U) + ",":U
    + cQ + "offset":U       + cQ + ":":U + STRING(iOffset) + ",":U
    + cQ + "limit":U        + cQ + ":":U + STRING(iLimit)
    + cCB.

COPY-LOB FROM OBJECT cJson TO FILE cOutputFile NO-ERROR.
IF ERROR-STATUS:ERROR THEN
    RUN WriteError("Failed to write output: ":U + ERROR-STATUS:GET-MESSAGE(1)).

DELETE OBJECT hQuery  NO-ERROR.
DELETE OBJECT hBuffer NO-ERROR.
