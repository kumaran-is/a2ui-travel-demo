"""FastAPI application for the Travel Planning Agent."""

import json
import logging
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

from app.agent import build_agent
from app.config import settings
from app.tools import HOTELS, FLIGHTS

logger = structlog.get_logger(__name__)

# Module-level globals, initialized in lifespan
session_service: InMemorySessionService = None
runner: Runner = None
APP_NAME = "travel_agent"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize ADK runner and session service on startup."""
    global session_service, runner
    session_service = InMemorySessionService()
    agent = build_agent()
    runner = Runner(
        agent=agent,
        app_name=APP_NAME,
        session_service=session_service,
    )
    logger.info("travel_agent_started", app_name=APP_NAME)
    yield
    logger.info("travel_agent_stopped")


app = FastAPI(title="Travel Planning Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    session_id: str


class ActionRequest(BaseModel):
    userAction: dict


async def _get_or_create_session(session_id: str):
    """Get existing session or create a new one."""
    session = await session_service.get_session(
        app_name=APP_NAME,
        user_id="demo_user",
        session_id=session_id,
    )
    if session is None:
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id="demo_user",
            session_id=session_id,
        )
    return session


async def _stream_agent_response(message: str, session_id: str):
    """Run agent and stream A2UI JSON messages as SSE events."""
    try:
        await _get_or_create_session(session_id)

        content = types.Content(
            role="user",
            parts=[types.Part(text=message)],
        )

        async for event in runner.run_async(
            user_id="demo_user",
            session_id=session_id,
            new_message=content,
        ):
            if event.is_final_response():
                response_text = event.content.parts[0].text if event.content and event.content.parts else ""

                if not response_text:
                    # Gemini occasionally returns an empty final response (non-deterministic).
                    # Log and emit a retry-prompt surface instead of silently yielding nothing.
                    logger.warning("agent_empty_response", session_id=session_id)
                    retry_surface = {
                        "surfaceUpdate": {
                            "surfaceId": "main",
                            "components": [
                                {"id": "root", "component": {"type": "Card", "child": "err-col"}},
                                {"id": "err-col", "component": {"type": "Column", "children": {"explicitList": ["err-icon", "err-text", "err-hint"]}}},
                                {"id": "err-icon", "component": {"type": "Text", "text": {"literalString": "⚠ No response from agent"}, "usageHint": "h3"}},
                                {"id": "err-text", "component": {"type": "Text", "text": {"literalString": "The agent returned an empty response. This can happen occasionally with Gemini."}, "usageHint": "body"}},
                                {"id": "err-hint", "component": {"type": "Text", "text": {"literalString": "Please try your search again."}, "usageHint": "body"}},
                            ],
                        }
                    }
                    begin = {"beginRendering": {"surfaceId": "main", "root": "root"}}
                    yield f"data: {json.dumps(retry_surface)}\n\n"
                    yield f"data: {json.dumps(begin)}\n\n"
                    continue

                # Extract all JSON objects from the response text.
                # Gemini may concatenate multiple objects on one line with no separator,
                # so we use raw_decode to consume them one by one.
                decoder = json.JSONDecoder()
                text = response_text.strip()
                pos = 0
                found_any = False
                while pos < len(text):
                    # Skip whitespace between objects
                    while pos < len(text) and text[pos] in ' \t\n\r':
                        pos += 1
                    if pos >= len(text):
                        break
                    if text[pos] != '{':
                        # Non-JSON prefix — skip to next '{'
                        next_brace = text.find('{', pos)
                        if next_brace == -1:
                            break
                        pos = next_brace
                        continue
                    try:
                        parsed, end_pos = decoder.raw_decode(text, pos)
                        # Normalize: Gemini sometimes omits the "surfaceUpdate" wrapper key
                        if isinstance(parsed, dict) and "surfaceId" in parsed and "components" in parsed and "surfaceUpdate" not in parsed:
                            parsed = {"surfaceUpdate": parsed}
                        yield f"data: {json.dumps(parsed)}\n\n"
                        pos += end_pos - pos
                        found_any = True
                    except json.JSONDecodeError:
                        logger.warning("agent_non_json_at_pos", pos=pos, snippet=text[pos:pos+50])
                        pos += 1

                if not found_any:
                    logger.warning("agent_no_json_in_response", text=response_text[:200])
                    error_surface = {
                        "surfaceUpdate": {
                            "surfaceId": "main",
                            "components": [
                                {"id": "root", "component": {"type": "Card", "child": "err-col"}},
                                {"id": "err-col", "component": {"type": "Column", "children": {"explicitList": ["err-icon", "err-text"]}}},
                                {"id": "err-icon", "component": {"type": "Text", "text": {"literalString": "⚠ Unexpected agent response"}, "usageHint": "h3"}},
                                {"id": "err-text", "component": {"type": "Text", "text": {"literalString": response_text[:300] or "Agent response could not be parsed. Please try again."}, "usageHint": "body"}},
                            ],
                        }
                    }
                    begin = {"beginRendering": {"surfaceId": "main", "root": "root"}}
                    yield f"data: {json.dumps(error_surface)}\n\n"
                    yield f"data: {json.dumps(begin)}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as exc:
        logger.error("agent_stream_error", error=str(exc), session_id=session_id)
        error_msg = {"error": "agent_error", "detail": str(exc)}
        yield f"data: {json.dumps(error_msg)}\n\n"
        yield "data: [DONE]\n\n"


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/chat")
async def chat(request: ChatRequest):
    """Chat endpoint — streams A2UI surfaceUpdate messages as SSE."""
    return StreamingResponse(
        _stream_agent_response(request.message, request.session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _build_hotel_results_surface(destination: str, nights: int) -> list[dict]:
    """Build A2UI hotel results surface. Shows hotel cards only — no flights section.
    No LLM involved — deterministic, no hallucinations."""
    key = destination.lower().strip()
    hotels = HOTELS.get(key, [])

    components = []
    root_children = []

    # --- Hotels section ---
    if hotels:
        root_children.append("hotels-heading")
        components.append({"id": "hotels-heading", "component": {
            "type": "Text", "text": {"literalString": f"🏨 Hotels in {destination.title()}"}, "usageHint": "h2"
        }})
        for h in hotels[:3]:
            hid = h["id"]
            total = h["price_per_night"] * nights
            root_children.append(f"card-{hid}")
            btn_id = f"btn-{hid}"
            lbl_id = f"lbl-{hid}"
            col_children = [f"name-{hid}", f"price-{hid}", btn_id]
            components += [
                {"id": f"card-{hid}", "component": {"type": "Card", "child": f"col-{hid}"}},
                {"id": f"col-{hid}", "component": {"type": "Column", "children": {"explicitList": col_children}}},
                {"id": f"name-{hid}", "component": {"type": "Text", "text": {"literalString": h["name"]}, "usageHint": "h3"}},
                {"id": f"price-{hid}", "component": {"type": "Text", "text": {
                    "literalString": f"${h['price_per_night']}/night · {nights} nights · ${total} total"
                }, "usageHint": "body"}},
                {"id": btn_id, "component": {
                    "type": "Button", "primary": True, "child": lbl_id,
                    "action": {"name": "book_hotel", "context": [
                        {"key": "hotelId", "value": {"literalString": hid}},
                    ]},
                }},
                {"id": lbl_id, "component": {"type": "Text", "text": {"literalString": "Book Hotel"}}},
            ]
    elif not hotels:
        root_children.append("no-results")
        components.append({"id": "no-results", "component": {
            "type": "Text",
            "text": {"literalString": f"No hotels found for '{destination}'. Try Paris, Tokyo, London, or New York."},
            "usageHint": "body",
        }})

    components.insert(0, {"id": "root", "component": {
        "type": "Column", "children": {"explicitList": root_children}
    }})
    surface = {"surfaceUpdate": {"surfaceId": "main", "components": components}}
    begin = {"beginRendering": {"surfaceId": "main", "root": "root"}}
    return [surface, begin]


def _build_flight_results_surface(to_city: str, from_city: str, date: str) -> list[dict]:
    """Build A2UI flight results surface directly from FLIGHTS data. No LLM."""
    key = to_city.lower().strip()
    flights = FLIGHTS.get(key, [])

    components = []
    root_children = []

    heading_text = f"✈ Flights from {from_city.title()} to {to_city.title()}" if from_city else f"✈ Flights to {to_city.title()}"
    root_children.append("heading")
    components.append({"id": "heading", "component": {
        "type": "Text", "text": {"literalString": heading_text}, "usageHint": "h2"
    }})

    if flights:
        for f in flights[:2]:
            fid = f["id"]
            root_children.append(f"card-{fid}")
            col_children = [f"airline-{fid}", f"route-{fid}", f"price-{fid}", f"book-{fid}"]
            lbl_id = f"lbl-book-{fid}"
            components += [
                {"id": f"card-{fid}", "component": {"type": "Card", "child": f"col-{fid}"}},
                {"id": f"col-{fid}", "component": {"type": "Column", "children": {"explicitList": col_children}}},
                {"id": f"airline-{fid}", "component": {"type": "Text", "text": {"literalString": f["airline"]}, "usageHint": "h3"}},
                {"id": f"route-{fid}", "component": {"type": "Text", "text": {
                    "literalString": f"{f['departure']} → {f['arrival']} · {f['duration']}"
                }, "usageHint": "body"}},
                {"id": f"price-{fid}", "component": {"type": "Text", "text": {"literalString": f"${f['price']} per person"}, "usageHint": "body"}},
                {"id": f"book-{fid}", "component": {
                    "type": "Button", "primary": fid == flights[0]["id"], "child": lbl_id,
                    "action": {"name": "book_flight", "context": [
                        {"key": "flightId", "value": {"literalString": fid}},
                    ]},
                }},
                {"id": lbl_id, "component": {"type": "Text", "text": {"literalString": f"Book {f['airline']}"}}},
            ]
    else:
        root_children.append("no-results")
        components.append({"id": "no-results", "component": {
            "type": "Text",
            "text": {"literalString": f"No flights found to '{to_city}'. Try Paris, Tokyo, London, or New York."},
            "usageHint": "body",
        }})

    components.insert(0, {"id": "root", "component": {
        "type": "Column", "children": {"explicitList": root_children}
    }})
    surface = {"surfaceUpdate": {"surfaceId": "main", "components": components}}
    begin = {"beginRendering": {"surfaceId": "main", "root": "root"}}
    return [surface, begin]


async def _stream_direct(messages: list[dict]):
    """Stream a pre-built list of A2UI messages without calling the LLM."""
    for msg in messages:
        yield f"data: {json.dumps(msg)}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/action")
async def action(request: ActionRequest):
    """User action endpoint.
    Search actions are handled deterministically (no LLM).
    Booking actions go through the agent for natural language confirmation.
    """
    user_action = request.userAction
    action_name = user_action.get("name", "unknown")
    context = user_action.get("context", {})
    session_id = context.get("sessionId", user_action.get("surfaceId", "main"))

    sse_headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}

    if action_name == "search_hotels_form":
        destination = context.get("destination", "").strip()
        checkin = context.get("checkin", "")
        checkout = context.get("checkout", "")
        # Calculate nights from dates; default 3
        nights = 3
        if checkin and checkout:
            try:
                from datetime import date as dt
                nights = max(1, (dt.fromisoformat(checkout) - dt.fromisoformat(checkin)).days)
            except ValueError:
                nights = 3
        logger.info("search_hotels_direct", destination=destination, nights=nights)
        msgs = _build_hotel_results_surface(destination, nights)
        return StreamingResponse(_stream_direct(msgs), media_type="text/event-stream", headers=sse_headers)

    if action_name == "search_flights_form":
        to_city = context.get("to", "").strip()
        from_city = context.get("from", "").strip()
        date = context.get("date", "")
        logger.info("search_flights_direct", from_city=from_city, to_city=to_city)
        msgs = _build_flight_results_surface(to_city, from_city, date)
        return StreamingResponse(_stream_direct(msgs), media_type="text/event-stream", headers=sse_headers)

    # Booking actions still go through the agent LLM
    if action_name == "book_hotel":
        hotel_id = context.get("hotelId", "")
        flight_id = context.get("flightId", "")
        if flight_id:
            message = f"Book hotel {hotel_id} with flight {flight_id}. Please confirm the booking."
        else:
            message = f"Book hotel {hotel_id} only (no flight). Please confirm the hotel-only booking."
    elif action_name == "book_flight":
        flight_id = context.get("flightId", "")
        message = f"Book flight {flight_id}. No hotel. Flight-only booking. Please confirm."
    else:
        message = f"User action: {action_name}. Context: {json.dumps(context)}"

    return StreamingResponse(
        _stream_agent_response(message, session_id),
        media_type="text/event-stream",
        headers=sse_headers,
    )
