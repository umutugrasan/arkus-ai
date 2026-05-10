"""
Standart pagination yardimcisi.
Tum liste endpoint'lerinde tutarli ?page= & ?per_page= destegi.
"""

from typing import Optional
from fastapi import Query
from pydantic import BaseModel


class PaginationParams:
    def __init__(
        self,
        page: int = Query(1, ge=1, description="1-indexed sayfa numarasi"),
        per_page: int = Query(20, ge=1, le=200, description="Sayfa basina kayit (max 200)"),
    ):
        self.page = page
        self.per_page = per_page
        self.offset = (page - 1) * per_page


class Page(BaseModel):
    items: list
    page: int
    per_page: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool


def paginate_query(query, params: PaginationParams) -> Page:
    """SQLAlchemy query'i sayfalandirip serialized response yapar."""
    total = query.count()
    items = query.offset(params.offset).limit(params.per_page).all()
    total_pages = (total + params.per_page - 1) // params.per_page if params.per_page else 1
    return Page(
        items=items,
        page=params.page,
        per_page=params.per_page,
        total=total,
        total_pages=total_pages,
        has_next=params.page < total_pages,
        has_prev=params.page > 1,
    )


def paginate_list(items: list, params: PaginationParams) -> Page:
    """Memory'deki listeyi sayfalandirir (calculator turevli sonuclar icin)."""
    total = len(items)
    sliced = items[params.offset : params.offset + params.per_page]
    total_pages = (total + params.per_page - 1) // params.per_page if params.per_page else 1
    return Page(
        items=sliced,
        page=params.page,
        per_page=params.per_page,
        total=total,
        total_pages=total_pages,
        has_next=params.page < total_pages,
        has_prev=params.page > 1,
    )
