import asyncio
import pytest
from collections import OrderedDict
from app import _get_ingest_lock, _ingest_locks
import app

@pytest.mark.asyncio
async def test_get_ingest_lock_basic():
    # Clear any existing locks
    _ingest_locks.clear()
    
    lock1 = await _get_ingest_lock("repo_a")
    assert isinstance(lock1, asyncio.Lock)
    
    # Retrieve again, should be the exact same lock instance
    lock2 = await _get_ingest_lock("repo_a")
    assert lock1 is lock2

@pytest.mark.asyncio
async def test_get_ingest_lock_lru_eviction():
    # Clear locks
    _ingest_locks.clear()
    
    # Temporarily patch _MAX_INGEST_LOCKS to a small value for testing eviction
    original_max = app._MAX_INGEST_LOCKS
    app._MAX_INGEST_LOCKS = 3
    
    try:
        lock_a = await _get_ingest_lock("repo_a")
        lock_b = await _get_ingest_lock("repo_b")
        lock_c = await _get_ingest_lock("repo_c")
        
        assert len(_ingest_locks) == 3
        assert "repo_a" in _ingest_locks
        
        # Access repo_a again to make it recently used
        await _get_ingest_lock("repo_a")
        
        # Add repo_d, which should trigger eviction of the least recently used (repo_b)
        lock_d = await _get_ingest_lock("repo_d")
        
        assert len(_ingest_locks) == 3
        assert "repo_b" not in _ingest_locks
        assert "repo_a" in _ingest_locks
        assert "repo_c" in _ingest_locks
        assert "repo_d" in _ingest_locks
        
        # Retrieve repo_b again, should create a new lock instance
        lock_b_new = await _get_ingest_lock("repo_b")
        assert len(_ingest_locks) == 3
        # repo_c should now be evicted
        assert "repo_c" not in _ingest_locks
        
    finally:
        # Restore original max limit
        app._MAX_INGEST_LOCKS = original_max
