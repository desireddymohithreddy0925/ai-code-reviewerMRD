import os
import pytest
from unittest.mock import patch

os.environ["CHROMA_HOST"] = ""
os.environ["CHROMA_PERSIST_DIR"] = ""

import chromadb
import rag


@pytest.fixture(autouse=True)
def fresh_rag_state():
    rag._client = None
    rag._collection = None
    yield
    rag._client = None
    rag._collection = None


@pytest.fixture
def isolated_collection(request):
    test_name = request.node.name.replace("[", "_").replace("]", "_").replace(" ", "_")
    collection_name = f"test_{test_name}_{id(request)}"
    client = chromadb.EphemeralClient()
    collection = client.get_or_create_collection(
        collection_name,
        metadata={"hnsw:space": "cosine"},
    )
    with patch.object(rag, "_get_client", return_value=client):
        with patch.object(rag, "_get_collection", return_value=collection):
            yield collection


class TestIngestChunks:
    def test_ingest_chunks_returns_count(self, isolated_collection):
        chunks = ["def foo(): pass", "class Bar: pass"]
        metadatas = [{"source": "test.py"}, {"source": "test2.py"}]
        ids = ["id0", "id1"]
        count = rag.ingest_chunks(chunks, metadatas, ids)
        assert count == 2

    def test_ingest_chunks_stores_chunks(self, isolated_collection):
        chunks = ["x = 1"]
        metadatas = [{"f": "a.py"}]
        ids = ["c0"]
        rag.ingest_chunks(chunks, metadatas, ids)
        assert isolated_collection.count() == 1


class TestQueryChunks:
    def test_query_chunks_returns_list_of_dicts(self, isolated_collection):
        chunks = ["python function definition syntax", "javascript arrow function"]
        metadatas = [{"lang": "py"}, {"lang": "js"}]
        ids = ["q0", "q1"]
        rag.ingest_chunks(chunks, metadatas, ids)

        results = rag.query_chunks("function syntax", n_results=2)

        assert isinstance(results, list)
        assert len(results) == 2
        assert all("chunk_id" in r for r in results)
        assert all("content" in r for r in results)
        assert all("metadata" in r for r in results)
        assert all("similarity_score" in r for r in results)

    def test_query_chunks_with_empty_collection(self, isolated_collection):
        results = rag.query_chunks("anything", n_results=5)
        assert results == []

    def test_query_chunks_n_results_respected(self, isolated_collection):
        chunks = ["apple fruit", "banana fruit", "cherry fruit", "date fruit", "elderberry"]
        metadatas = [{"i": i} for i in range(5)]
        ids = [f"r{i}" for i in range(5)]
        rag.ingest_chunks(chunks, metadatas, ids)

        results = rag.query_chunks("fruit", n_results=3)
        assert len(results) == 3


class TestGetCollectionStats:
    def test_returns_collection_stats_dict(self, isolated_collection):
        chunks = ["test content"]
        metadatas = [{"t": "1"}]
        ids = ["s0"]
        rag.ingest_chunks(chunks, metadatas, ids)

        stats = rag.get_collection_stats()

        assert isinstance(stats, dict)
        assert "collection" in stats
        assert "chunk_count" in stats
        assert "embedding_dimension" in stats
        assert stats["collection"] == rag._COLLECTION_NAME
        assert stats["chunk_count"] >= 1
        assert isinstance(stats["embedding_dimension"], int)
        assert stats["embedding_dimension"] > 0