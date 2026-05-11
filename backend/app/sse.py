"""
Server-Sent Events (SSE) yardimcilari.
Gemini token akisini frontend'e parca parca gondermek icin.
"""

import json
from typing import AsyncIterator
from fastapi.responses import StreamingResponse


async def sse_from_gemini_stream(
    chunk_iter: AsyncIterator[dict],
    extra_initial: dict = None,
):
    """
    Gemini stream chunk'larini SSE event'lerine cevirir.
    event: chunk | done | error
    """
    if extra_initial:
        yield f"event: meta\ndata: {json.dumps(extra_initial, ensure_ascii=False)}\n\n"

    full_text = []
    async for chunk in chunk_iter:
        if chunk.get("done"):
            event = "error" if chunk.get("error") else "done"
            payload = {
                "full_text": "".join(full_text),
                "model": chunk.get("model"),
                "chunks": chunk.get("chunks"),
            }
            if chunk.get("error"):
                payload["error"] = chunk["error"]
            yield f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
            return
        else:
            txt = chunk.get("text", "")
            if txt:
                full_text.append(txt)
                yield f"event: chunk\ndata: {json.dumps({'text': txt}, ensure_ascii=False)}\n\n"


def sse_response(generator):
    """SSE response objesi olustur (CORS + no-cache header'lariyla)."""
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # nginx buffering kapat
        },
    )
