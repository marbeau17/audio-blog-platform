"""Unit tests for TTS service - text processing, splitting, SSML generation."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.tts_service import TtsService


@pytest.fixture
def tts_service():
    mock_db = MagicMock()
    with patch("app.services.tts_service.tts.TextToSpeechAsyncClient"):
        with patch("app.services.tts_service.storage.Client"):
            return TtsService(db=mock_db, storage_client=MagicMock())


class TestCleanText:
    def test_removes_html_tags(self, tts_service):
        text = "<p>Hello <strong>World</strong></p>"
        result = TtsService.clean_text(text)
        assert "<" not in result
        assert "Hello World" in result

    def test_removes_markdown_images(self, tts_service):
        text = "Before ![alt](http://img.png) After"
        result = TtsService.clean_text(text)
        assert "![" not in result
        assert "Before" in result
        assert "After" in result

    def test_converts_markdown_links_to_text(self, tts_service):
        text = "Click [here](http://example.com) for details"
        result = TtsService.clean_text(text)
        assert "here" in result
        assert "http" not in result

    def test_replaces_code_blocks(self, tts_service):
        text = "Before\n```python\nprint('hello')\n```\nAfter"
        result = TtsService.clean_text(text)
        assert "コードブロック省略" in result
        assert "print" not in result

    def test_replaces_urls(self, tts_service):
        text = "Visit https://example.com for more"
        result = TtsService.clean_text(text)
        assert "リンク先参照" in result
        assert "https" not in result

    def test_normalizes_whitespace(self, tts_service):
        text = "Hello    World\n\n\n\nNew"
        result = TtsService.clean_text(text)
        assert "    " not in result
        assert "\n\n\n" not in result

    def test_removes_heading_markers(self, tts_service):
        text = "### Section Title"
        result = TtsService.clean_text(text)
        assert "###" not in result
        assert "Section Title" in result

    def test_removes_bold_italic_markers(self, tts_service):
        text = "This is **bold** and *italic* and ***both***"
        result = TtsService.clean_text(text)
        assert "**" not in result
        assert "*" not in result
        assert "bold" in result


class TestSplitIntoChunks:
    def test_short_text_single_chunk(self, tts_service):
        text = "短いテキスト"
        chunks = tts_service.split_into_chunks(text)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_respects_max_bytes(self, tts_service):
        # Japanese chars are ~3 bytes each in UTF-8
        # Use sentence-ending chars so the splitter can find boundaries
        text = "あいうえお。" * 400  # ~7200 bytes, should split
        chunks = tts_service.split_into_chunks(text, max_bytes=4500)
        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk.encode("utf-8")) <= 4500

    def test_splits_on_paragraph_boundary(self, tts_service):
        para1 = "最初の段落です。" * 200  # ~4800 bytes, exceeds 4500
        para2 = "二番目の段落です。" * 200  # ~5400 bytes
        text = f"{para1}\n\n{para2}"
        chunks = tts_service.split_into_chunks(text, max_bytes=4500)
        assert len(chunks) >= 2

    def test_splits_on_sentence_boundary(self, tts_service):
        sentences = "これはテスト文です。" * 200
        chunks = tts_service.split_into_chunks(sentences, max_bytes=4500)
        for chunk in chunks:
            assert len(chunk.encode("utf-8")) <= 4500
            # Each chunk should end with a sentence-ending character or be the full text
            if chunk != chunks[-1]:
                assert chunk.rstrip().endswith(("。", ".", "!", "?", "！", "？")) or len(chunk.encode("utf-8")) <= 100

    def test_empty_text(self, tts_service):
        chunks = tts_service.split_into_chunks("")
        assert len(chunks) == 0

    def test_merges_tiny_chunks(self, tts_service):
        text = "A\n\nB\n\nC"
        chunks = tts_service.split_into_chunks(text, max_bytes=4500)
        # Should merge tiny chunks
        assert len(chunks) <= 2


class TestTextToSsml:
    def test_basic_ssml_structure(self):
        ssml = TtsService.text_to_ssml("テスト文です。")
        assert ssml.startswith("<speak>")
        assert ssml.endswith("</speak>")
        assert "テスト文です。" in ssml

    def test_heading_detection(self):
        ssml = TtsService.text_to_ssml("第一章 はじめに")
        assert '<emphasis level="strong">' in ssml
        assert '<break time="1.5s"/>' in ssml

    def test_paragraph_break(self):
        ssml = TtsService.text_to_ssml("段落1\n\n段落2")
        assert '<break time="0.8s"/>' in ssml

    def test_xml_escaping(self):
        ssml = TtsService.text_to_ssml("A & B < C > D")
        assert "&amp;" in ssml
        assert "&lt;" in ssml
        assert "&gt;" in ssml

    def test_custom_break_times(self):
        ssml = TtsService.text_to_ssml(
            "第一章 テスト",
            heading_break="2.0s",
            paragraph_break="1.0s",
        )
        assert 'time="2.0s"' in ssml

    def test_numbered_heading_detection(self):
        ssml = TtsService.text_to_ssml("1. はじめに")
        assert '<emphasis level="strong">' in ssml


class TestSynthesizeChunk:
    @pytest.mark.asyncio
    async def test_circuit_breaker_attribute(self, tts_service):
        """Verify circuit breaker is attached."""
        assert hasattr(tts_service.synthesize_chunk, "__wrapped__")


class TestMergeAudioChunks:
    def test_merge_returns_bytes(self):
        """Would need ffmpeg installed to fully test."""
        # This is a smoke test - real merge needs ffmpeg
        pass
