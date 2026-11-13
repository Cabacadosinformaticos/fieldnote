from starlette.requests import Request

from app.security import origin

PEER = ("10.0.0.1", 1234)


def _request(forwarded: str | None = None, client: tuple[str, int] | None = PEER) -> Request:
    headers = [] if forwarded is None else [(b"x-forwarded-for", forwarded.encode("latin-1"))]
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/health",
            "headers": headers,
            "client": client,
            "scheme": "https",
            "query_string": b"",
            "server": ("testserver", 443),
        }
    )


def test_a_valid_forwarded_address_is_used() -> None:
    assert origin._address(_request("192.0.2.10")) == "192.0.2.10"


def test_the_address_traefik_appended_is_the_rightmost_entry() -> None:
    assert origin._address(_request("203.0.113.41, 10.0.0.9")) == "10.0.0.9"


def test_an_ipv6_address_is_normalised() -> None:
    assert origin._address(_request("2001:0db8:0:0:0:0:0:1")) == "2001:db8::1"


def test_junk_falls_back_to_the_peer() -> None:
    assert origin._address(_request("not-an-address")) == "10.0.0.1"


def test_a_valid_earlier_entry_does_not_rescue_a_junk_last_entry() -> None:
    assert origin._address(_request("192.0.2.10, junk")) == "10.0.0.1"


def test_an_over_long_header_is_ignored() -> None:
    assert origin._address(_request("192.0.2.10," + "9" * 2000)) == "10.0.0.1"


def test_an_absent_header_uses_the_peer() -> None:
    assert origin._address(_request()) == "10.0.0.1"


def test_a_missing_peer_gives_no_address() -> None:
    assert origin._address(_request(client=None)) is None
