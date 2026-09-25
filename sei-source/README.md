# SEI source documents

Drop the SEI-provided documents here, then run:

    python3 tools/ingest_sei_docs.py

Name them so the id and version are picked up from the filename:

    file-ingestion-tdd-v2.0.pdf
    dbt-transformation-tdd-v2.pdf
    integration-architecture-v5.pdf
    build-spec.pdf

`.pdf`, `.txt` and `.md` are all accepted. If no PDF backend is installed
(`pip install pypdf`, or `apt-get install poppler-utils` for `pdftotext`),
export the PDF to text yourself and drop the `.txt` in instead.

The tool writes `ui/src/seiSourceDocs.js`. The citation map in
`ui/src/seiCitations.js` is maintained by hand and is never regenerated, so a
re-ingest does not lose it.

**These documents are not committed.** `.gitignore` excludes everything here
except this README — they are SEI's, and the repository is not where they live.
