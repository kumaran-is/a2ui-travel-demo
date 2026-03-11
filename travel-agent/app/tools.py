"""Travel planning tools with hardcoded data for demo purposes."""

import random
import string
from google.adk.tools import ToolContext


HOTELS: dict[str, list[dict]] = {
    "paris": [
        {
            "id": "H1",
            "name": "Hotel Le Meurice",
            "price_per_night": 450,
            "stars": 5,
            "amenities": ["Spa", "Fine Dining", "Concierge"],
            "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400",
        },
        {
            "id": "H2",
            "name": "Hotel des Grands Boulevards",
            "price_per_night": 220,
            "stars": 4,
            "amenities": ["Bar", "Terrace", "Free WiFi"],
            "image_url": "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400",
        },
        {
            "id": "H3",
            "name": "Generator Paris",
            "price_per_night": 85,
            "stars": 3,
            "amenities": ["Free WiFi", "Bar", "Lounge"],
            "image_url": "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400",
        },
    ],
    "tokyo": [
        {
            "id": "H4",
            "name": "Park Hyatt Tokyo",
            "price_per_night": 520,
            "stars": 5,
            "amenities": ["Pool", "Spa", "City Views"],
            "image_url": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400",
        },
        {
            "id": "H5",
            "name": "Shinjuku Granbell Hotel",
            "price_per_night": 180,
            "stars": 4,
            "amenities": ["Rooftop Bar", "Free WiFi", "Gym"],
            "image_url": "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400",
        },
        {
            "id": "H6",
            "name": "Khaosan Tokyo Kabuki",
            "price_per_night": 60,
            "stars": 3,
            "amenities": ["Free WiFi", "Shared Kitchen", "Lounge"],
            "image_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400",
        },
    ],
    "new york": [
        {
            "id": "H7",
            "name": "The Plaza Hotel",
            "price_per_night": 680,
            "stars": 5,
            "amenities": ["Spa", "Fine Dining", "Central Park Views"],
            "image_url": "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400",
        },
        {
            "id": "H8",
            "name": "citizenM New York Bowery",
            "price_per_night": 210,
            "stars": 4,
            "amenities": ["Rooftop Bar", "Free WiFi", "24h Canteen"],
            "image_url": "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=400",
        },
        {
            "id": "H9",
            "name": "HI NYC Hostel",
            "price_per_night": 65,
            "stars": 3,
            "amenities": ["Free WiFi", "Common Room", "Kitchen"],
            "image_url": "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=400",
        },
    ],
}

HOTELS["london"] = [
    {
        "id": "H10",
        "name": "The Savoy",
        "price_per_night": 580,
        "stars": 5,
        "amenities": ["River Views", "Spa", "Fine Dining"],
        "image_url": "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=400",
    },
    {
        "id": "H11",
        "name": "citizenM London Shoreditch",
        "price_per_night": 195,
        "stars": 4,
        "amenities": ["Rooftop Bar", "Free WiFi", "24h Canteen"],
        "image_url": "https://images.unsplash.com/photo-1560347876-aeef00ee58a1?w=400",
    },
    {
        "id": "H12",
        "name": "Generator London",
        "price_per_night": 75,
        "stars": 3,
        "amenities": ["Free WiFi", "Bar", "Lounge"],
        "image_url": "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400",
    },
]

FLIGHTS: dict[str, list[dict]] = {
    "paris": [
        {
            "id": "F1",
            "airline": "Air France",
            "departure": "JFK 09:00",
            "arrival": "CDG 22:30",
            "price": 620,
            "duration": "7h 30m",
        },
        {
            "id": "F2",
            "airline": "British Airways",
            "departure": "JFK 18:00",
            "arrival": "CDG 08:15+1",
            "price": 540,
            "duration": "8h 15m",
        },
    ],
    "tokyo": [
        {
            "id": "F3",
            "airline": "Japan Airlines",
            "departure": "JFK 11:00",
            "arrival": "NRT 15:00+1",
            "price": 980,
            "duration": "14h 00m",
        },
        {
            "id": "F4",
            "airline": "ANA",
            "departure": "JFK 23:45",
            "arrival": "NRT 04:30+2",
            "price": 870,
            "duration": "13h 45m",
        },
    ],
    "london": [
        {
            "id": "F7",
            "airline": "British Airways",
            "departure": "JFK 09:00",
            "arrival": "LHR 21:15",
            "price": 580,
            "duration": "7h 15m",
        },
        {
            "id": "F8",
            "airline": "Virgin Atlantic",
            "departure": "JFK 22:30",
            "arrival": "LHR 10:45+1",
            "price": 490,
            "duration": "7h 15m",
        },
    ],
    "new york": [
        {
            "id": "F5",
            "airline": "Delta",
            "departure": "LAX 06:00",
            "arrival": "JFK 14:20",
            "price": 320,
            "duration": "5h 20m",
        },
        {
            "id": "F6",
            "airline": "American Airlines",
            "departure": "LAX 10:30",
            "arrival": "JFK 18:45",
            "price": 280,
            "duration": "5h 15m",
        },
    ],
}


def search_hotels(destination: str, nights: int, tool_context: ToolContext) -> dict:
    """Search for available hotels at the given destination.

    Call this tool when the user asks about hotels, accommodation, or places to stay
    at a specific destination. Returns a list of available hotels with pricing.

    Args:
        destination: The city or location to search hotels for (e.g. "Paris", "Tokyo", "New York").
        nights: Number of nights the user wants to stay.
        tool_context: ADK tool context for session state access.

    Returns:
        A dict with 'hotels' list, each containing id, name, price_per_night, total_price,
        stars, amenities, and image_url. Returns empty list for unknown destinations.
    """
    key = destination.lower().strip()
    hotels = HOTELS.get(key, [])
    results = []
    for hotel in hotels:
        results.append({
            **hotel,
            "total_price": hotel["price_per_night"] * nights,
            "nights": nights,
        })
    tool_context.state["last_search_destination"] = destination
    tool_context.state["last_search_nights"] = nights
    return {"destination": destination, "nights": nights, "hotels": results}


def search_flights(destination: str, date: str, tool_context: ToolContext) -> dict:
    """Search for available flights to the given destination.

    Call this tool when the user asks about flights or travel to a specific destination.
    Returns available flight options with pricing and duration.

    Args:
        destination: The destination city to fly to (e.g. "Paris", "Tokyo", "New York").
        date: Desired travel date in YYYY-MM-DD format or natural language like "next Friday".
        tool_context: ADK tool context for session state access.

    Returns:
        A dict with 'flights' list, each containing id, airline, departure, arrival,
        price, and duration. Returns empty list for unknown destinations.
    """
    key = destination.lower().strip()
    flights = FLIGHTS.get(key, [])
    tool_context.state["last_flight_destination"] = destination
    return {"destination": destination, "date": date, "flights": flights}


def book_trip(hotel_id: str, flight_id: str, tool_context: ToolContext) -> dict:
    """Book a hotel and flight combination for the user.

    Call this tool when the user wants to confirm a booking, clicks a Book button,
    or explicitly asks to book a specific hotel or flight. Generates a booking reference
    and stores it in the session.

    Args:
        hotel_id: The ID of the hotel to book (e.g. "H1", "H2").
        flight_id: The ID of the flight to book (e.g. "F1", "F2"). Pass empty string if no flight.
        tool_context: ADK tool context for session state access.

    Returns:
        A dict with booking_ref, status ("confirmed"), hotel details, flight details, and message.
    """
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    booking_ref = f"TRV-{suffix}"

    destination = tool_context.state.get("last_search_destination", "Unknown")
    nights = tool_context.state.get("last_search_nights", 1)

    # Find hotel details from hardcoded data
    hotel = None
    for hotels_list in HOTELS.values():
        for h in hotels_list:
            if h["id"] == hotel_id:
                hotel = h
                break

    # Find flight details
    flight = None
    for flights_list in FLIGHTS.values():
        for f in flights_list:
            if f["id"] == flight_id:
                flight = f
                break

    tool_context.state["booking_ref"] = booking_ref
    tool_context.state["booked_hotel_id"] = hotel_id
    tool_context.state["booked_flight_id"] = flight_id

    return {
        "booking_ref": booking_ref,
        "status": "confirmed",
        "destination": destination,
        "hotel": hotel,
        "flight": flight,
        "nights": nights,
        "message": f"Booking confirmed! Your reference is {booking_ref}.",
    }
