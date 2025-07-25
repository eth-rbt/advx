from backend.config.settings import Settings


def test_config_env_loads(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://example.com:1234/9")
    s = Settings()
    assert s.redis_url.endswith("/9")
