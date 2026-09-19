# EVENT-360

Drop the SEI event specification workbook (.xlsx) in this folder.

The loader takes the single workbook it finds here, whatever it is named, and
logs which one it used. If there are two it refuses and lists them rather than
guessing — set `CP_EVENT360_XLSX` to the one you mean.

```bash
python -m ingestion.run event360
```

Expected shape: 8 sheets, 105 event rows, 575 field rows. Sheet 8
(`Extraction_Status`) is not loaded. See `INSTALL_EVENT360.md`.
