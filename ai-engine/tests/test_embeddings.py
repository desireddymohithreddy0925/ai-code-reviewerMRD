import pytest
from embeddings import get_embedding_dimension, embed_text, embed_texts


class TestGetEmbeddingDimension:
    def test_returns_positive_integer(self):
        dim = get_embedding_dimension()
        assert isinstance(dim, int)
        assert dim > 0

    def test_returns_expected_minilm_dimension(self):
        dim = get_embedding_dimension()
        assert dim == 384


class TestEmbedText:
    def test_returns_list_of_floats(self):
        result = embed_text("hello world")
        assert isinstance(result, list)
        assert len(result) > 0
        assert all(isinstance(v, (int, float)) for v in result)

    def test_returns_embedding_of_expected_dimension(self):
        text = "the quick brown fox jumps over the lazy dog"
        result = embed_text(text)
        expected_dim = get_embedding_dimension()
        assert len(result) == expected_dim

    def test_returns_normalized_vector(self):
        result = embed_text("test string")
        magnitude = sum(v * v for v in result) ** 0.5
        assert abs(magnitude - 1.0) < 0.01

    def test_handles_multiline_content(self):
        code = "def hello():\n    print('world')\n    return True"
        result = embed_text(code)
        assert isinstance(result, list)
        assert len(result) == get_embedding_dimension()


class TestEmbedTexts:
    def test_returns_list_of_embedding_vectors(self):
        texts = ["hello", "world", "foo bar"]
        result = embed_texts(texts)
        assert isinstance(result, list)
        assert len(result) == 3
        assert all(isinstance(v, list) for v in result)
        assert all(len(v) == get_embedding_dimension() for v in result)

    def test_returns_empty_list_for_empty_input(self):
        result = embed_texts([])
        assert result == []

    def test_batch_consistency_with_single(self):
        single = embed_text("consistent test content")
        batch = embed_texts(["consistent test content"])
        assert len(batch) == 1
        assert batch[0] == single

    def test_different_texts_produce_different_embeddings(self):
        result = embed_texts(["apple", "banana", "car"])
        assert len(result) == 3
        # At least one pair should differ
        assert result[0] != result[1] or result[1] != result[2]