"""Unit tests for travel agent tools — no real Gemini API calls."""

from unittest.mock import MagicMock
from google.adk.tools import ToolContext

from app.tools import search_hotels, search_flights, book_trip


def make_tool_context() -> ToolContext:
    """Create a mock ToolContext with a real dict as state."""
    ctx = MagicMock(spec=ToolContext)
    ctx.state = {}
    return ctx


def test_search_hotels_paris_returns_3_results():
    ctx = make_tool_context()
    result = search_hotels("Paris", 3, ctx)
    assert result["destination"] == "Paris"
    assert result["nights"] == 3
    assert len(result["hotels"]) == 3
    assert result["hotels"][0]["id"] == "H1"
    assert result["hotels"][0]["total_price"] == 450 * 3


def test_search_hotels_unknown_destination_returns_empty():
    ctx = make_tool_context()
    result = search_hotels("Atlantis", 2, ctx)
    assert result["hotels"] == []
    assert result["destination"] == "Atlantis"


def test_search_flights_paris_returns_2_flights():
    ctx = make_tool_context()
    result = search_flights("Paris", "2026-04-01", ctx)
    assert len(result["flights"]) == 2
    assert result["flights"][0]["airline"] == "Air France"
    assert result["flights"][1]["airline"] == "British Airways"


def test_book_trip_writes_booking_ref_to_session_state():
    ctx = make_tool_context()
    ctx.state["last_search_destination"] = "Paris"
    ctx.state["last_search_nights"] = 3
    result = book_trip("H1", "F1", ctx)
    assert result["status"] == "confirmed"
    assert result["booking_ref"].startswith("TRV-")
    assert len(result["booking_ref"]) == 10  # TRV- + 6 chars
    assert ctx.state["booking_ref"] == result["booking_ref"]
    assert ctx.state["booked_hotel_id"] == "H1"
    assert ctx.state["booked_flight_id"] == "F1"


def test_search_hotels_stores_destination_in_state():
    ctx = make_tool_context()
    search_hotels("Tokyo", 5, ctx)
    assert ctx.state["last_search_destination"] == "Tokyo"
    assert ctx.state["last_search_nights"] == 5
