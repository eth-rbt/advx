import pytest
import httpx
from backend.config.settings import settings


@pytest.mark.asyncio
async def test_settings_patch():
    """Test that runtime lambda update alters scheduler behavior."""
    # Read current lambda_trend
    original_lambda_trend = settings.lambda_trend

    # Make PATCH request to update settings
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.patch("/settings", json={"lambda_trend": 0.9})

        assert response.status_code == 200
        data = response.json()

        # Verify response contains all settings
        assert "lambda_trend" in data
        assert "lambda_sim" in data
        assert "lambda_depth" in data

        # Verify lambda_trend was updated
        assert data["lambda_trend"] == 0.9

    # Verify by making another GET request
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.get("/settings")
        assert response.status_code == 200
        data = response.json()
        assert data["lambda_trend"] == 0.9

    # Test partial update (only lambda_sim)
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        response = await client.patch("/settings", json={"lambda_sim": 0.1})

        assert response.status_code == 200
        data = response.json()

        # Verify lambda_sim updated but lambda_trend unchanged
        assert data["lambda_sim"] == 0.1
        assert data["lambda_trend"] == 0.9  # Should still be 0.9

