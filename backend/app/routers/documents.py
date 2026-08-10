import json
import sqlite3
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request

from app.models import DocumentDetail, DocumentSummary, SaveDocumentRequest

router = APIRouter()


def _row_to_detail(row: sqlite3.Row) -> DocumentDetail:
    return DocumentDetail(
        id=row["id"],
        slug=row["slug"],
        title=row["title"],
        formData=json.loads(row["form_data"]),
        markdown=row["markdown"],
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
    )


def _connect(request: Request) -> sqlite3.Connection:
    conn = sqlite3.connect(request.app.state.db_path)
    conn.row_factory = sqlite3.Row
    return conn


@router.put("/saved-documents/{document_id}", response_model=DocumentDetail)
def save_document(
    document_id: str, payload: SaveDocumentRequest, request: Request
) -> DocumentDetail:
    """Autosave upsert: the frontend mints document_id once (a UUID) and
    reuses it for every subsequent save of the same in-progress document, so
    this single endpoint covers both the first save and every save after it.
    """
    conn = _connect(request)
    try:
        existing = conn.execute(
            "SELECT user_id FROM documents WHERE id = ?", (document_id,)
        ).fetchone()
        if existing and existing["user_id"] != payload.userId:
            # Same 404 the read endpoints use for a missing/not-owned id: a
            # UUID collision with another user's document is exactly as
            # inaccessible to this caller as one that doesn't exist at all.
            raise HTTPException(status_code=404, detail="Document not found.")

        conn.execute(
            """
            INSERT INTO documents (id, user_id, slug, title, form_data, markdown)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                form_data = excluded.form_data,
                markdown = excluded.markdown,
                updated_at = datetime('now')
            """,
            (
                document_id,
                payload.userId,
                payload.slug,
                payload.title,
                json.dumps(payload.formData),
                payload.markdown,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM documents WHERE id = ?", (document_id,)
        ).fetchone()
    finally:
        conn.close()
    return _row_to_detail(row)


@router.get("/saved-documents", response_model=list[DocumentSummary])
def list_documents(userId: str, request: Request) -> list[DocumentSummary]:
    conn = _connect(request)
    try:
        rows = conn.execute(
            """
            SELECT id, slug, title, created_at, updated_at FROM documents
            WHERE user_id = ?
            ORDER BY updated_at DESC
            """,
            (userId,),
        ).fetchall()
    finally:
        conn.close()
    return [
        DocumentSummary(
            id=row["id"],
            slug=row["slug"],
            title=row["title"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
        )
        for row in rows
    ]


@router.get("/saved-documents/{document_id}", response_model=DocumentDetail)
def get_document(document_id: str, userId: str, request: Request) -> DocumentDetail:
    conn = _connect(request)
    try:
        row = conn.execute(
            "SELECT * FROM documents WHERE id = ? AND user_id = ?",
            (document_id, userId),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Document not found.")
    return _row_to_detail(row)
