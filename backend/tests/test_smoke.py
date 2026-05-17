"""
Happy-path smoke testleri. AI cagrisi yapmazlar — sadece sistemin ayakta,
auth + route'larin temel cevap verdigini dogrularlar.
"""


def test_health_live(client):
    r = client.get("/health/live")
    assert r.status_code == 200
    assert r.json() == {"status": "alive"}


def test_root_metadata(client):
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert data["api_prefix"] == "/api/v1"
    assert data["name"] == "Arkus AI"


def test_register_login_me_flow(client, auth_token):
    r = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert r.status_code == 200
    user = r.json()
    assert user["email"] == "smoketest@arkus.ai"
    assert user["name"] == "Smoke Test"


def test_dashboard_requires_auth(client):
    # Token'siz 401
    r = client.get("/api/v1/dashboard/overview")
    assert r.status_code == 401


def test_dashboard_overview_with_auth(client, auth_token):
    r = client.get(
        "/api/v1/dashboard/overview",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert r.status_code == 200
    # Henuz bagli pazaryeri yok — overview 0 metriklerle de gelir
    data = r.json()
    assert "overall" in data
    assert "by_marketplace" in data


def test_agents_status(client, auth_token):
    r = client.get(
        "/api/v1/agents/status",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "agents" in data
    assert data["total_agents"] == 3
    agent_names = {a["name"] for a in data["agents"]}
    assert agent_names == {"ReviewAnalyzerAgent", "CompetitorWatchAgent", "ReportAgent"}
