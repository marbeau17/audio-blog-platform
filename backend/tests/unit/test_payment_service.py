"""Unit tests for PaymentService."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from app.services.payment_service import PaymentService


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def payment_service(mock_db):
    with patch("app.services.payment_service.stripe"):
        return PaymentService(mock_db)


class TestCheckPurchase:
    @pytest.mark.asyncio
    async def test_purchased_returns_true(self, payment_service, mock_db):
        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {"access_granted": True}
        mock_db.collection.return_value.document.return_value \
            .collection.return_value.document.return_value.get = AsyncMock(return_value=doc)

        result = await payment_service.check_purchase("user_1", "content_1")
        assert result is True

    @pytest.mark.asyncio
    async def test_not_purchased_returns_false(self, payment_service, mock_db):
        doc = MagicMock()
        doc.exists = False
        mock_db.collection.return_value.document.return_value \
            .collection.return_value.document.return_value.get = AsyncMock(return_value=doc)

        result = await payment_service.check_purchase("user_1", "content_1")
        assert result is False

    @pytest.mark.asyncio
    async def test_revoked_returns_false(self, payment_service, mock_db):
        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {"access_granted": False}
        mock_db.collection.return_value.document.return_value \
            .collection.return_value.document.return_value.get = AsyncMock(return_value=doc)

        result = await payment_service.check_purchase("user_1", "content_1")
        assert result is False


class TestCreatePaymentIntent:
    @pytest.mark.asyncio
    async def test_already_purchased_raises_conflict(self, payment_service, mock_db):
        # Mock check_purchase to return True
        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {"access_granted": True}
        mock_db.collection.return_value.document.return_value \
            .collection.return_value.document.return_value.get = AsyncMock(return_value=doc)

        from app.core.exceptions import ConflictException
        with pytest.raises(ConflictException):
            await payment_service.create_payment_intent("user_1", "content_1")

    @pytest.mark.asyncio
    async def test_free_content_raises_conflict(self, payment_service, mock_db):
        # Not purchased
        purchase_doc = MagicMock()
        purchase_doc.exists = False
        mock_db.collection.return_value.document.return_value \
            .collection.return_value.document.return_value.get = AsyncMock(return_value=purchase_doc)

        # Content is free
        content_doc = MagicMock()
        content_doc.exists = True
        content_doc.to_dict.return_value = {
            "pricing": {"type": "free", "price_jpy": 0},
            "creator_id": "creator_1",
        }

        def side_effect(name):
            mock_col = MagicMock()
            if name == "users":
                mock_user_doc = MagicMock()
                mock_user_doc_ref = MagicMock()
                mock_purchase_col = MagicMock()
                mock_purchase_doc = MagicMock()
                mock_purchase_doc.get = AsyncMock(return_value=purchase_doc)
                mock_purchase_col.document.return_value = mock_purchase_doc
                mock_user_doc_ref.collection.return_value = mock_purchase_col
                mock_col.document.return_value = mock_user_doc_ref
            elif name == "contents":
                mock_content_ref = MagicMock()
                mock_content_ref.get = AsyncMock(return_value=content_doc)
                mock_col.document.return_value = mock_content_ref
            return mock_col

        mock_db.collection.side_effect = side_effect

        from app.core.exceptions import ConflictException
        with pytest.raises(ConflictException, match="free"):
            await payment_service.create_payment_intent("user_1", "content_1")


class TestHandlePaymentSucceeded:
    @pytest.mark.asyncio
    async def test_creates_purchase_record(self, payment_service, mock_db):
        payment_intent = {
            "id": "pi_test_123",
            "amount": 1000,
            "application_fee_amount": 200,
            "latest_charge": "ch_test_123",
            "metadata": {
                "buyer_id": "user_1",
                "content_id": "content_1",
                "creator_id": "creator_1",
            },
        }

        # Mock transaction document
        tx_ref = MagicMock()
        tx_ref.id = "tx_001"
        tx_ref.set = AsyncMock()
        mock_db.collection.return_value.document.return_value = tx_ref

        # Mock content document
        content_doc = MagicMock()
        content_doc.exists = True
        content_doc.to_dict.return_value = {
            "title": "Test Content",
            "thumbnail_url": None,
            "creator_display_name": "Creator",
            "stats": {"purchase_count": 0, "total_revenue": 0},
        }

        # Setup collection routing
        call_count = {"n": 0}

        def collection_side_effect(name):
            mock = MagicMock()
            if name == "transactions":
                mock.document.return_value = tx_ref
            elif name == "contents":
                doc_ref = MagicMock()
                doc_ref.get = AsyncMock(return_value=content_doc)
                doc_ref.update = AsyncMock()
                mock.document.return_value = doc_ref
            elif name == "users":
                user_ref = MagicMock()
                purchases_col = MagicMock()
                purchase_ref = AsyncMock()
                purchase_ref.set = AsyncMock()
                purchases_col.document.return_value = purchase_ref
                user_ref.collection.return_value = purchases_col
                mock.document.return_value = user_ref
            return mock

        mock_db.collection.side_effect = collection_side_effect

        await payment_service.handle_payment_succeeded(payment_intent)
        tx_ref.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_missing_metadata_skips(self, payment_service, mock_db):
        payment_intent = {"id": "pi_test", "metadata": {}}
        await payment_service.handle_payment_succeeded(payment_intent)
        # Should not raise, just log warning


class TestHandleRefund:
    @pytest.mark.asyncio
    async def test_no_intent_id_returns(self, payment_service, mock_db):
        charge = {"id": "ch_test"}
        await payment_service.handle_refund(charge)
        # Should not raise


class TestGetPurchases:
    @pytest.mark.asyncio
    async def test_returns_purchase_list(self, payment_service, mock_db):
        doc1 = MagicMock()
        doc1.id = "purchase_1"
        doc1.to_dict.return_value = {"content_id": "c1", "price_jpy": 500,
                                      "purchased_at": datetime.now(timezone.utc)}

        mock_query = MagicMock()
        async def _stream():
            yield doc1
        mock_query.limit.return_value.stream.return_value = _stream()

        mock_db.collection.return_value.document.return_value \
            .collection.return_value.order_by.return_value = mock_query

        items, cursor = await payment_service.get_purchases("user_1")
        assert len(items) == 1
        assert items[0]["purchase_id"] == "purchase_1"
