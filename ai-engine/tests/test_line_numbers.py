from text_splitter import _calculate_line_numbers


class TestCalculateLineNumbers:
    def test_single_chunk_full_content(self):
        content = "line1\nline2\nline3"
        chunks = ["line1\nline2\nline3"]
        result = _calculate_line_numbers(content, chunks)
        assert len(result) == 1
        assert result[0] == (0, 2)

    def test_two_chunks_sequential(self):
        content = "line1\nline2\nline3\nline4\nline5"
        chunks = ["line1\nline2\nline3", "line4\nline5"]
        result = _calculate_line_numbers(content, chunks)
        assert len(result) == 2
        # First chunk lines 0-2, second chunk follows with line range (3, 4)
        assert result[0] == (0, 2)
        assert result[1] == (3, 4)

    def test_chunk_not_found_returns_zero_zero(self):
        content = "original content here"
        chunks = ["chunk not in content"]
        result = _calculate_line_numbers(content, chunks)
        assert result[0] == (0, 0)

    def test_empty_chunks_list(self):
        content = "some content"
        chunks = []
        result = _calculate_line_numbers(content, chunks)
        assert result == []

    def test_three_single_line_chunks(self):
        content = "line1\nline2\nline3"
        chunks = ["line1", "line2", "line3"]
        result = _calculate_line_numbers(content, chunks)
        # Single-line chunks have 0 embedded newlines each
        assert len(result) == 3
        assert result[0] == (0, 0)
        assert result[1] == (1, 1)
        assert result[2] == (2, 2)
