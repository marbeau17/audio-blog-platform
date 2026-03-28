"""Unit tests for CreatorService."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta
from app.services.creator_service import CreatorService
from app.core.exceptions import NotFoundException


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def creator_service(mock_db):
    return CreatorService(mock_db)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_content_doc(doc_id, title="Test Content", play_count=0,
                      purchase_count=0, total_revenue=0, creator_id="creator_1"):
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = {
        "creator_id": creator_id,
        "title": title,
        "is_deleted": False,
        "stats": {
            "play_count": play_count,
            "purchase_count": purchase_count,
            "total_revenue": total_revenue,
        },
    }
    return doc


def _make_tx_doc(doc_id, seller_earnings=500, created_at=None, tx_type="purchase",
                 content_id="content_1"):
    if created_at is None:
        created_at = datetime.now(timezone.utc)
    doc = MagicMock()
    doc.id = doc_id
    doc.to_dict.return_value = {
        "transaction_id": doc_id,
        "seller_id": "creator_1",
        "seller_earnings": seller_earnings,
        "status": "completed",
        "type": tx_type,
        "content_id": content_id,
        "created_at": created_at,
    }
    return doc


def _make_user_doc(exists=True, total_earnings=10000, charges_enabled=True):
    doc = MagicMock()
    doc.exists = exists
    doc.to_dict.return_value = {
        "creator_profile": {
            "total_earnings": total_earnings,
            "charges_enabled": charges_enabled,
        },
    }
    return doc


def _async_stream(docs):
    """Return an async iterator that yields the given docs."""
    async def _stream():
        for d in docs:
            yield d
    return _stream()


def _setup_collections(mock_db, *, user_doc=None, content_docs=None, tx_docs=None):
    """Wire up mock_db.collection(...) to return appropriate mocks for
    'users', 'contents', and 'transactions' collections."""

    content_query = MagicMock()
    content_query.where.return_value = content_query
    content_query.stream.return_value = _async_stream(content_docs or [])

    tx_query = MagicMock()
    tx_query.where.return_value = tx_query
    tx_query.order_by.return_value = tx_query
    tx_query.limit.return_value = tx_query
    tx_query.stream.return_value = _async_stream(tx_docs or [])

    user_ref = MagicMock()
    user_ref.get = AsyncMock(return_value=user_doc or _make_user_doc(exists=False))

    def collection_side_effect(name):
        mock_col = MagicMock()
        if name == "users":
            mock_col.document.return_value = user_ref
        elif name == "contents":
            mock_col.where.return_value = content_query
        elif name == "transactions":
            mock_col.where.return_value = tx_query
        return mock_col

    mock_db.collection.side_effect = collection_side_effect


# ---------------------------------------------------------------------------
# TestGetDashboard
# ---------------------------------------------------------------------------

class TestGetDashboard:
    @pytest.mark.asyncio
    async def test_returns_summary_with_earnings_content_plays_purchases(
        self, creator_service, mock_db
    ):
        now = datetime.now(timezone.utc)
        user_doc = _make_user_doc(exists=True, total_earnings=25000)
        content_docs = [
            _make_content_doc("c1", title="Article A", play_count=100,
                              purchase_count=10, total_revenue=5000),
            _make_content_doc("c2", title="Article B", play_count=50,
                              purchase_count=5, total_revenue=2500),
        ]
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=1000, created_at=now - timedelta(days=1)),
            _make_tx_doc("tx2", seller_earnings=500, created_at=now - timedelta(days=2)),
        ]

        _setup_collections(mock_db, user_doc=user_doc,
                           content_docs=content_docs, tx_docs=tx_docs)

        result = await creator_service.get_dashboard_summary("creator_1")

        assert result["total_earnings"] == 25000
        assert result["total_content"] == 2
        assert result["total_plays"] == 150
        assert result["total_purchases"] == 15
        assert result["pending_earnings"] == 1500
        assert len(result["recent_earnings"]) == 2
        assert len(result["top_content"]) == 2
        # Top content sorted by revenue descending
        assert result["top_content"][0]["revenue"] == 5000
        assert result["top_content"][1]["revenue"] == 2500

    @pytest.mark.asyncio
    async def test_handles_new_creator_with_no_data(self, creator_service, mock_db):
        user_doc = _make_user_doc(exists=True, total_earnings=0)
        _setup_collections(mock_db, user_doc=user_doc,
                           content_docs=[], tx_docs=[])

        result = await creator_service.get_dashboard_summary("creator_1")

        assert result["total_earnings"] == 0
        assert result["pending_earnings"] == 0
        assert result["total_content"] == 0
        assert result["total_plays"] == 0
        assert result["total_purchases"] == 0
        assert result["recent_earnings"] == []
        assert result["top_content"] == []

    @pytest.mark.asyncio
    async def test_raises_not_found_for_missing_creator(self, creator_service, mock_db):
        user_doc = _make_user_doc(exists=False)
        _setup_collections(mock_db, user_doc=user_doc)

        with pytest.raises(NotFoundException):
            await creator_service.get_dashboard_summary("nonexistent")

    @pytest.mark.asyncio
    async def test_recent_earnings_sorted_descending_by_date(
        self, creator_service, mock_db
    ):
        now = datetime.now(timezone.utc)
        user_doc = _make_user_doc(exists=True, total_earnings=0)
        # Two transactions on different days
        day1 = now - timedelta(days=5)
        day2 = now - timedelta(days=1)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=300, created_at=day1),
            _make_tx_doc("tx2", seller_earnings=700, created_at=day2),
        ]
        _setup_collections(mock_db, user_doc=user_doc,
                           content_docs=[], tx_docs=tx_docs)

        result = await creator_service.get_dashboard_summary("creator_1")

        dates = [e["date"] for e in result["recent_earnings"]]
        assert dates == sorted(dates, reverse=True)

    @pytest.mark.asyncio
    async def test_daily_earnings_aggregated_per_day(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        same_day = now - timedelta(days=1)
        user_doc = _make_user_doc(exists=True, total_earnings=0)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=200, created_at=same_day),
            _make_tx_doc("tx2", seller_earnings=300, created_at=same_day),
        ]
        _setup_collections(mock_db, user_doc=user_doc,
                           content_docs=[], tx_docs=tx_docs)

        result = await creator_service.get_dashboard_summary("creator_1")

        assert len(result["recent_earnings"]) == 1
        assert result["recent_earnings"][0]["amount"] == 500

    @pytest.mark.asyncio
    async def test_top_content_limited_to_10(self, creator_service, mock_db):
        user_doc = _make_user_doc(exists=True, total_earnings=0)
        content_docs = [
            _make_content_doc(f"c{i}", total_revenue=i * 100) for i in range(15)
        ]
        _setup_collections(mock_db, user_doc=user_doc,
                           content_docs=content_docs, tx_docs=[])

        result = await creator_service.get_dashboard_summary("creator_1")

        assert len(result["top_content"]) == 10
        assert result["top_content"][0]["revenue"] == 1400


# ---------------------------------------------------------------------------
# TestGetAnalytics
# ---------------------------------------------------------------------------

class TestGetAnalytics:
    @pytest.mark.asyncio
    async def test_returns_analytics_for_7d_period(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=1000, created_at=now - timedelta(days=2)),
        ]
        _setup_collections(mock_db, tx_docs=tx_docs)

        result = await creator_service.get_analytics("creator_1", period="7d")

        assert result["period"] == "7d"
        assert result["granularity"] == "daily"
        assert result["summary"]["total_revenue"] == 1000
        assert result["summary"]["total_transactions"] == 1
        assert len(result["time_series"]) == 1

    @pytest.mark.asyncio
    async def test_returns_analytics_for_30d_period(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=500, created_at=now - timedelta(days=10)),
            _make_tx_doc("tx2", seller_earnings=300, created_at=now - timedelta(days=20)),
        ]
        _setup_collections(mock_db, tx_docs=tx_docs)

        result = await creator_service.get_analytics("creator_1", period="30d")

        assert result["period"] == "30d"
        assert result["summary"]["total_revenue"] == 800
        assert result["summary"]["total_transactions"] == 2

    @pytest.mark.asyncio
    async def test_returns_analytics_for_90d_period(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=2000, created_at=now - timedelta(days=60)),
        ]
        _setup_collections(mock_db, tx_docs=tx_docs)

        result = await creator_service.get_analytics("creator_1", period="90d")

        assert result["period"] == "90d"
        assert result["summary"]["total_revenue"] == 2000

    @pytest.mark.asyncio
    async def test_handles_content_id_filter(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=800, content_id="content_A",
                         created_at=now - timedelta(days=5)),
        ]
        _setup_collections(mock_db, tx_docs=tx_docs)

        result = await creator_service.get_analytics(
            "creator_1", content_id="content_A"
        )

        assert result["content_id"] == "content_A"
        assert result["summary"]["total_revenue"] == 800

    @pytest.mark.asyncio
    async def test_content_id_none_by_default(self, creator_service, mock_db):
        _setup_collections(mock_db, tx_docs=[])

        result = await creator_service.get_analytics("creator_1")

        assert result["content_id"] is None

    @pytest.mark.asyncio
    async def test_daily_granularity(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        day1 = now - timedelta(days=2)
        day2 = now - timedelta(days=3)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=100, created_at=day1),
            _make_tx_doc("tx2", seller_earnings=200, created_at=day2),
        ]
        _setup_collections(mock_db, tx_docs=tx_docs)

        result = await creator_service.get_analytics(
            "creator_1", granularity="daily"
        )

        assert result["granularity"] == "daily"
        assert len(result["time_series"]) == 2
        for entry in result["time_series"]:
            # daily format: YYYY-MM-DD
            assert len(entry["period"]) == 10

    @pytest.mark.asyncio
    async def test_weekly_granularity(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=100, created_at=now - timedelta(days=1)),
        ]
        _setup_collections(mock_db, tx_docs=tx_docs)

        result = await creator_service.get_analytics(
            "creator_1", granularity="weekly"
        )

        assert result["granularity"] == "weekly"
        for entry in result["time_series"]:
            assert "-W" in entry["period"]

    @pytest.mark.asyncio
    async def test_monthly_granularity(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=100, created_at=now - timedelta(days=1)),
        ]
        _setup_collections(mock_db, tx_docs=tx_docs)

        result = await creator_service.get_analytics(
            "creator_1", granularity="monthly"
        )

        assert result["granularity"] == "monthly"
        for entry in result["time_series"]:
            # monthly format: YYYY-MM
            assert len(entry["period"]) == 7

    @pytest.mark.asyncio
    async def test_tips_aggregated_separately(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        same_day = now - timedelta(days=1)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=1000, tx_type="purchase",
                         created_at=same_day),
            _make_tx_doc("tx2", seller_earnings=300, tx_type="tip",
                         created_at=same_day),
        ]
        _setup_collections(mock_db, tx_docs=tx_docs)

        result = await creator_service.get_analytics("creator_1")

        entry = result["time_series"][0]
        assert entry["revenue"] == 1000
        assert entry["tips"] == 300
        assert entry["purchases"] == 2

    @pytest.mark.asyncio
    async def test_empty_transactions_returns_empty_time_series(
        self, creator_service, mock_db
    ):
        _setup_collections(mock_db, tx_docs=[])

        result = await creator_service.get_analytics("creator_1")

        assert result["summary"]["total_revenue"] == 0
        assert result["summary"]["total_transactions"] == 0
        assert result["time_series"] == []

    @pytest.mark.asyncio
    async def test_time_series_sorted_ascending(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=100,
                         created_at=now - timedelta(days=5)),
            _make_tx_doc("tx2", seller_earnings=200,
                         created_at=now - timedelta(days=1)),
            _make_tx_doc("tx3", seller_earnings=300,
                         created_at=now - timedelta(days=10)),
        ]
        _setup_collections(mock_db, tx_docs=tx_docs)

        result = await creator_service.get_analytics("creator_1")

        periods = [e["period"] for e in result["time_series"]]
        assert periods == sorted(periods)

    @pytest.mark.asyncio
    async def test_unknown_period_defaults_to_30_days(self, creator_service, mock_db):
        _setup_collections(mock_db, tx_docs=[])

        result = await creator_service.get_analytics("creator_1", period="unknown")

        assert result["period"] == "unknown"
        # Still functions without error
        assert result["time_series"] == []


# ---------------------------------------------------------------------------
# TestGetEarnings
# ---------------------------------------------------------------------------

class TestGetEarnings:
    @pytest.mark.asyncio
    async def test_returns_earnings_with_transaction_breakdown(
        self, creator_service, mock_db
    ):
        now = datetime.now(timezone.utc)
        user_doc = _make_user_doc(exists=True, total_earnings=15000,
                                  charges_enabled=True)
        tx_docs = [
            _make_tx_doc("tx1", seller_earnings=1000, created_at=now - timedelta(days=1)),
            _make_tx_doc("tx2", seller_earnings=500, created_at=now - timedelta(days=2)),
        ]
        _setup_collections(mock_db, user_doc=user_doc, tx_docs=tx_docs)

        result = await creator_service.get_earnings("creator_1")

        assert result["total_earnings"] == 15000
        assert result["charges_enabled"] is True
        assert len(result["recent_transactions"]) == 2
        assert result["recent_transactions"][0]["transaction_id"] == "tx1"
        assert result["recent_transactions"][1]["transaction_id"] == "tx2"

    @pytest.mark.asyncio
    async def test_handles_no_transactions(self, creator_service, mock_db):
        user_doc = _make_user_doc(exists=True, total_earnings=0,
                                  charges_enabled=False)
        _setup_collections(mock_db, user_doc=user_doc, tx_docs=[])

        result = await creator_service.get_earnings("creator_1")

        assert result["total_earnings"] == 0
        assert result["charges_enabled"] is False
        assert result["recent_transactions"] == []

    @pytest.mark.asyncio
    async def test_raises_not_found_for_missing_creator(
        self, creator_service, mock_db
    ):
        user_doc = _make_user_doc(exists=False)
        _setup_collections(mock_db, user_doc=user_doc)

        with pytest.raises(NotFoundException):
            await creator_service.get_earnings("nonexistent")

    @pytest.mark.asyncio
    async def test_transaction_includes_id(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        user_doc = _make_user_doc(exists=True, total_earnings=0)
        tx_docs = [_make_tx_doc("tx_abc", seller_earnings=100, created_at=now)]
        _setup_collections(mock_db, user_doc=user_doc, tx_docs=tx_docs)

        result = await creator_service.get_earnings("creator_1")

        tx = result["recent_transactions"][0]
        assert tx["transaction_id"] == "tx_abc"

    @pytest.mark.asyncio
    async def test_charges_enabled_from_profile(self, creator_service, mock_db):
        user_doc = _make_user_doc(exists=True, total_earnings=0,
                                  charges_enabled=False)
        _setup_collections(mock_db, user_doc=user_doc, tx_docs=[])

        result = await creator_service.get_earnings("creator_1")

        assert result["charges_enabled"] is False

    @pytest.mark.asyncio
    async def test_preserves_transaction_data_fields(self, creator_service, mock_db):
        now = datetime.now(timezone.utc)
        user_doc = _make_user_doc(exists=True, total_earnings=5000)
        tx_docs = [_make_tx_doc("tx1", seller_earnings=750, created_at=now,
                                tx_type="tip", content_id="c_42")]
        _setup_collections(mock_db, user_doc=user_doc, tx_docs=tx_docs)

        result = await creator_service.get_earnings("creator_1")

        tx = result["recent_transactions"][0]
        assert tx["seller_earnings"] == 750
        assert tx["type"] == "tip"
        assert tx["content_id"] == "c_42"


# ---------------------------------------------------------------------------
# TestExportEarnings (method not yet implemented in creator_service.py)
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="export_earnings method not yet implemented in CreatorService")
class TestExportEarnings:
    @pytest.mark.asyncio
    async def test_returns_csv_formatted_data(self, creator_service, mock_db):
        pass

    @pytest.mark.asyncio
    async def test_handles_empty_data(self, creator_service, mock_db):
        pass

    @pytest.mark.asyncio
    async def test_correct_headers_and_formatting(self, creator_service, mock_db):
        pass


# ---------------------------------------------------------------------------
# TestGetStripeOnboardingUrl (method not yet implemented in creator_service.py)
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="get_stripe_onboarding_url method not yet implemented in CreatorService")
class TestGetStripeOnboardingUrl:
    @pytest.mark.asyncio
    async def test_successful_url_generation(self, creator_service, mock_db):
        pass

    @pytest.mark.asyncio
    async def test_creator_without_stripe_account(self, creator_service, mock_db):
        pass


# ---------------------------------------------------------------------------
# TestGetStripeStatus (method not yet implemented in creator_service.py)
# ---------------------------------------------------------------------------

@pytest.mark.skip(reason="get_stripe_status method not yet implemented in CreatorService")
class TestGetStripeStatus:
    @pytest.mark.asyncio
    async def test_connected_and_active_account(self, creator_service, mock_db):
        pass

    @pytest.mark.asyncio
    async def test_incomplete_account(self, creator_service, mock_db):
        pass

    @pytest.mark.asyncio
    async def test_no_account(self, creator_service, mock_db):
        pass
