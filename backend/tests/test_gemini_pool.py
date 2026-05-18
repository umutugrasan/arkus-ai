"""
gemini_service pool sistemine ait davranis testleri.

Test stratejisi:
- Module-level pool state'ini her test oncesi reset
- _init_pools_locked'i settings monkeypatch ile farkli senaryolarda kos
- Gercek genai.Client yaratmiyoruz — _get_client_for_key cagrilarini test etmiyoruz
- Sadece routing/cooldown/round-robin/fallback davranisini izole test ediyoruz
"""

import time
import pytest
from itertools import cycle

from app.services import gemini_service as gs


@pytest.fixture(autouse=True)
def reset_pool_state():
    """Her test oncesi ve sonrasi pool state'ini sifirla."""
    gs._pool_keys.clear()
    gs._pool_iters.clear()
    gs._clients_by_key.clear()
    gs._key_cooldown.clear()
    yield
    gs._pool_keys.clear()
    gs._pool_iters.clear()
    gs._clients_by_key.clear()
    gs._key_cooldown.clear()


def _force_pools(pools: dict):
    """Init bypass — direkt state'i kuran helper. _init_pools_locked'i atlar."""
    gs._pool_keys.clear()
    gs._pool_iters.clear()
    for name, keys in pools.items():
        gs._pool_keys[name] = list(keys)
        gs._pool_iters[name] = cycle(keys) if keys else None


# ─── 1. Backward compatibility ───────────────────────────────────────────────

def test_backward_compat_single_legacy_key(monkeypatch):
    """Sadece GEMINI_API_KEY tanimli, hicbir pool secret yok → tek-key default pool."""
    monkeypatch.setenv("GEMINI_API_KEY", "legacy-single-key")
    monkeypatch.setenv("GEMINI_API_KEYS_DEFAULT", "")
    monkeypatch.setenv("GEMINI_API_KEYS_AGENTS", "")
    monkeypatch.setenv("GEMINI_API_KEYS_CHAT", "")
    monkeypatch.setenv("GEMINI_API_KEYS_ANALYZE", "")
    monkeypatch.setenv("GEMINI_API_KEYS_VISION", "")
    # Settings cache'ini bypass et: yeni instance kur
    from app.config import Settings
    fresh = Settings()
    # Test sirasinda gs._init_pools_locked settings'i okuyor; geçici olarak değiştir
    monkeypatch.setattr(gs, "settings", fresh)

    gs._ensure_pools()
    # Default pool legacy key ile dolmali
    assert gs._pool_keys["default"] == ["legacy-single-key"]
    # Tum spesifik pool'lar bos veya default'a fallback
    for pool in ("agents", "chat", "analyze", "vision"):
        # Spesifik pool bos VEYA default'a yansidi (her ikisi de OK — implementasyon detayi)
        if gs._pool_keys[pool]:
            assert gs._pool_keys[pool] == ["legacy-single-key"], f"{pool} default'a fallback ediyor olmali"


def test_backward_compat_no_keys_at_all(monkeypatch):
    """Hicbir key yoksa pool'lar bos, get_client None doner."""
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEYS_DEFAULT", "")
    monkeypatch.setenv("GEMINI_API_KEYS_AGENTS", "")
    monkeypatch.setenv("GEMINI_API_KEYS_CHAT", "")
    monkeypatch.setenv("GEMINI_API_KEYS_ANALYZE", "")
    monkeypatch.setenv("GEMINI_API_KEYS_VISION", "")
    from app.config import Settings
    fresh = Settings()
    monkeypatch.setattr(gs, "settings", fresh)

    assert gs.get_client("default") is None
    assert gs.get_client("agents") is None
    assert gs.get_client("chat") is None


# ─── 2. Pool routing & round-robin ───────────────────────────────────────────

def test_round_robin_single_pool():
    """3 key olan pool'da 6 cagri 3 farkli key dondurmeli (2 tam tur)."""
    _force_pools({"agents": ["a", "b", "c"], "default": []})
    keys_seen = [gs._next_key_from_pool("agents") for _ in range(6)]
    assert sorted(set(keys_seen)) == ["a", "b", "c"]
    # Cycle order garantili: ilk 3'te a,b,c sirasiyla; sonraki 3'te tekrar
    assert keys_seen[0] == keys_seen[3]
    assert keys_seen[1] == keys_seen[4]
    assert keys_seen[2] == keys_seen[5]


def test_pool_isolation():
    """Farkli pool'lar farkli key'ler verir, biri tukenince digerine etki etmez."""
    _force_pools({
        "agents": ["agent-1", "agent-2"],
        "chat": ["chat-1"],
        "analyze": ["analyze-1", "analyze-2", "analyze-3"],
        "default": ["fallback"],
    })
    agent_keys = {gs._next_key_from_pool("agents") for _ in range(4)}
    chat_keys = {gs._next_key_from_pool("chat") for _ in range(4)}
    analyze_keys = {gs._next_key_from_pool("analyze") for _ in range(6)}

    assert agent_keys == {"agent-1", "agent-2"}
    assert chat_keys == {"chat-1"}
    assert analyze_keys == {"analyze-1", "analyze-2", "analyze-3"}


def test_unknown_pool_falls_back_to_default():
    """Tanimsiz pool ismi → default'a duser (next_key)."""
    _force_pools({"default": ["fallback-key"]})
    # 'unknown' diye bir pool yok → default'a duser
    key = gs._next_key_from_pool("unknown")
    assert key == "fallback-key"


# ─── 3. 429 cooldown ─────────────────────────────────────────────────────────

def test_mark_429_excludes_key_from_pool():
    """429 alan key sonraki cagrilara servis edilmez."""
    _force_pools({"agents": ["good", "bad"], "default": []})
    gs._mark_key_429("bad")
    # 10 ardisik cagri → hep 'good' donmeli
    for _ in range(10):
        assert gs._next_key_from_pool("agents") == "good"


def test_all_keys_cooled_down_returns_none():
    """Pool'daki tum key'ler cooldown'daysa None."""
    _force_pools({"agents": ["k1", "k2"], "default": []})
    gs._mark_key_429("k1")
    gs._mark_key_429("k2")
    assert gs._next_key_from_pool("agents") is None


def test_cooldown_expires():
    """Cooldown suresi gectikten sonra key tekrar kullanilir."""
    _force_pools({"agents": ["k1"], "default": []})
    # Cooldown'i 0.1 saniyeye dusur
    gs._key_cooldown["k1"] = time.time() + 0.1
    assert gs._next_key_from_pool("agents") is None
    time.sleep(0.15)
    assert gs._next_key_from_pool("agents") == "k1"


def test_cooled_down_pool_falls_back_to_default():
    """agents tum cooldown → default'a fallback."""
    _force_pools({
        "agents": ["a1", "a2"],
        "default": ["default-key"],
    })
    gs._mark_key_429("a1")
    gs._mark_key_429("a2")
    # _try_pool'un fallback davranisini test ettigimiz icin _next_key_from_pool
    # tek basina None doner; _try_pool default'a manuel fallback yapar
    assert gs._next_key_from_pool("agents") is None
    assert gs._next_key_from_pool("default") == "default-key"


# ─── 4. Edge case: placeholder/empty key filtering ───────────────────────────

def test_placeholder_keys_filtered(monkeypatch):
    """'your_gemini_api_key_here' placeholder pool'a alinmaz."""
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEYS_AGENTS", "your_gemini_api_key_here,real-key,  ")
    monkeypatch.setenv("GEMINI_API_KEYS_DEFAULT", "")
    monkeypatch.setenv("GEMINI_API_KEYS_CHAT", "")
    monkeypatch.setenv("GEMINI_API_KEYS_ANALYZE", "")
    monkeypatch.setenv("GEMINI_API_KEYS_VISION", "")
    from app.config import Settings
    fresh = Settings()
    monkeypatch.setattr(gs, "settings", fresh)
    gs._ensure_pools()
    assert gs._pool_keys["agents"] == ["real-key"]


def test_empty_strings_and_whitespace_filtered(monkeypatch):
    """' a , , b ,' → ['a', 'b']"""
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEYS_AGENTS", " a , , b ,")
    monkeypatch.setenv("GEMINI_API_KEYS_DEFAULT", "")
    monkeypatch.setenv("GEMINI_API_KEYS_CHAT", "")
    monkeypatch.setenv("GEMINI_API_KEYS_ANALYZE", "")
    monkeypatch.setenv("GEMINI_API_KEYS_VISION", "")
    from app.config import Settings
    fresh = Settings()
    monkeypatch.setattr(gs, "settings", fresh)
    gs._ensure_pools()
    assert gs._pool_keys["agents"] == ["a", "b"]


# ─── 5. Init: pool'lar configten doğru kuruluyor ──────────────────────────────

def test_init_pools_full_config(monkeypatch):
    """Tum 5 pool ayri tanimli."""
    monkeypatch.setenv("GEMINI_API_KEY", "legacy")
    monkeypatch.setenv("GEMINI_API_KEYS_AGENTS", "a1,a2")
    monkeypatch.setenv("GEMINI_API_KEYS_CHAT", "c1")
    monkeypatch.setenv("GEMINI_API_KEYS_ANALYZE", "an1,an2,an3")
    monkeypatch.setenv("GEMINI_API_KEYS_VISION", "v1")
    monkeypatch.setenv("GEMINI_API_KEYS_DEFAULT", "d1,d2")
    from app.config import Settings
    fresh = Settings()
    monkeypatch.setattr(gs, "settings", fresh)
    gs._ensure_pools()
    assert gs._pool_keys["agents"] == ["a1", "a2"]
    assert gs._pool_keys["chat"] == ["c1"]
    assert gs._pool_keys["analyze"] == ["an1", "an2", "an3"]
    assert gs._pool_keys["vision"] == ["v1"]
    assert gs._pool_keys["default"] == ["d1", "d2"]


def test_empty_specific_pool_inherits_default(monkeypatch):
    """Spesifik pool tanimsizsa default'un kopyasi olur."""
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEYS_AGENTS", "")  # bos
    monkeypatch.setenv("GEMINI_API_KEYS_CHAT", "")
    monkeypatch.setenv("GEMINI_API_KEYS_ANALYZE", "")
    monkeypatch.setenv("GEMINI_API_KEYS_VISION", "")
    monkeypatch.setenv("GEMINI_API_KEYS_DEFAULT", "fallback-1,fallback-2")
    from app.config import Settings
    fresh = Settings()
    monkeypatch.setattr(gs, "settings", fresh)
    gs._ensure_pools()
    assert gs._pool_keys["agents"] == ["fallback-1", "fallback-2"]
    assert gs._pool_keys["chat"] == ["fallback-1", "fallback-2"]
    assert gs._pool_keys["analyze"] == ["fallback-1", "fallback-2"]
    assert gs._pool_keys["vision"] == ["fallback-1", "fallback-2"]
    assert gs._pool_keys["default"] == ["fallback-1", "fallback-2"]


# ─── 6. get_client behavior ──────────────────────────────────────────────────

def test_get_client_returns_none_when_pool_empty():
    """Bos pool → None."""
    _force_pools({"agents": [], "default": []})
    assert gs.get_client("agents") is None


def test_get_client_returns_cached_per_key(monkeypatch):
    """Ayni key icin client cache'leniyor mu?"""
    _force_pools({"agents": ["k1", "k2"], "default": []})
    # genai.Client'i mock'la — gerçek API key validation yapilmasin
    created = []

    class FakeClient:
        def __init__(self, api_key):
            self.api_key = api_key
            created.append(api_key)

    # google.genai import'unu monkeypatch'le
    import sys
    fake_genai = type(sys)("google.genai")
    fake_genai.Client = FakeClient
    sys.modules["google"] = type(sys)("google")
    sys.modules["google.genai"] = fake_genai
    sys.modules["google"].genai = fake_genai

    # Ilk cagri — k1 icin client yarat
    c1 = gs.get_client("agents")
    # Ikinci cagri — k2 icin client yarat
    c2 = gs.get_client("agents")
    # Ucuncu cagri — k1 tekrar (cycle), cache'den gelmeli, yeni instance OLUSMAMALI
    c3 = gs.get_client("agents")

    # created listesinde k1 ve k2 bir kere gozukmeli (cache calistigi icin)
    assert created.count("k1") == 1
    assert created.count("k2") == 1


# ─── 7. Error classification ─────────────────────────────────────────────────

def test_is_quota_error_detection():
    """429 / resource_exhausted / quota → quota error olarak siniflandirilir."""
    assert gs._is_quota_error(Exception("429 Too Many Requests"))
    assert gs._is_quota_error(Exception("RESOURCE_EXHAUSTED quota exceeded"))
    assert gs._is_quota_error(Exception("daily quota reached"))
    assert not gs._is_quota_error(Exception("404 not found"))
    assert not gs._is_quota_error(Exception("503 unavailable"))


def test_is_unavailable_error_detection():
    """503 / unavailable / deadline → unavailable error."""
    assert gs._is_unavailable_error(Exception("503 server error"))
    assert gs._is_unavailable_error(Exception("service unavailable"))
    assert gs._is_unavailable_error(Exception("deadline exceeded"))
    assert not gs._is_unavailable_error(Exception("429"))


# ─── 8. _try_pool integration (with mocked call_fn) ──────────────────────────

def test_try_pool_succeeds_on_first_try():
    """Basarili cagri → ilk key + ilk model'le doner."""
    _force_pools({"agents": ["k1", "k2"], "default": []})

    def fake_call(client, model):
        return f"OK from {model}"

    # _get_client_for_key'i de mock'la — gercek genai.Client yaratma
    original = gs._get_client_for_key
    gs._get_client_for_key = lambda key: f"client-{key}"
    try:
        response, model, err = gs._try_pool("agents", fake_call)
        assert response is not None
        assert "OK from" in response
        assert model in gs.MODEL_CASCADE
        assert err is None
    finally:
        gs._get_client_for_key = original


def test_try_pool_429_moves_to_next_key():
    """Birinci key 429 verirse ikinci key'e gec."""
    _force_pools({"agents": ["bad", "good"], "default": []})

    call_log = []

    def fake_call(client, model):
        call_log.append(client)
        if client == "client-bad":
            raise Exception("429 quota exceeded")
        return f"OK with {client}"

    original = gs._get_client_for_key
    gs._get_client_for_key = lambda key: f"client-{key}"
    try:
        response, model, err = gs._try_pool("agents", fake_call)
        assert response is not None
        assert "client-good" in response
        # 'bad' key cooldown'a alindi mi?
        assert "bad" in gs._key_cooldown
    finally:
        gs._get_client_for_key = original


def test_try_pool_exhausted_falls_back_to_default():
    """Agents tum 429 olunca default pool'a fallback."""
    _force_pools({"agents": ["a1"], "default": ["d1"]})

    def fake_call(client, model):
        if "a1" in client:
            raise Exception("429")
        return f"OK with {client}"

    original = gs._get_client_for_key
    gs._get_client_for_key = lambda key: f"client-{key}"
    try:
        response, model, err = gs._try_pool("agents", fake_call)
        assert response is not None
        assert "client-d1" in response
    finally:
        gs._get_client_for_key = original


def test_try_pool_empty_pool_returns_error():
    """Hic key olmayan pool → None + hata."""
    _force_pools({"agents": [], "default": []})
    response, model, err = gs._try_pool("agents", lambda c, m: "never called")
    assert response is None
    assert err is not None
