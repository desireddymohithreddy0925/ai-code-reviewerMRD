import os
import json
import re
import time
import asyncio
import uuid
import unicodedata
from collections import OrderedDict
from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Set
from groq import Groq
from dotenv import load_dotenv
import bleach
from bleach.css_sanitizer import CSSSanitizer
from embeddings import is_fallback_active
from diff_helper import get_changed_files_from_git, filter_files_by_changes, format_diff_header

# Load environment variables: prefer local .env, fall back to backend/.env
env_paths = [
    os.path.join(os.path.dirname(__file__), '.env'),
    os.path.join(os.path.dirname(__file__), '../backend/.env'),
]
loaded = False
for env_path in env_paths:
    abs_path = os.path.abspath(env_path)
    if os.path.isfile(abs_path):
        load_dotenv(dotenv_path=abs_path)
        loaded = True
        print(f"📄 Loaded environment from {abs_path}")
        break
if not loaded:
    print("⚠️ No .env file found. Running with existing environment variables.")

MAX_FILE_CHARS_PER_FILE = int(os.getenv("MAX_FILE_CHARS_PER_FILE", "1500"))
MAX_CHAT_FILES = int(os.getenv("MAX_CHAT_FILES", "20"))
LLM_TIMEOUT_SECONDS = float(os.getenv("LLM_TIMEOUT_SECONDS", "30"))

_SHARED_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shared-safety-config.json')
try:
    with open(_SHARED_CONFIG_PATH) as _f:
        _shared_config = json.load(_f)
    _REQUIRED_KEYS = {'homoglyph_map', 'dangerous_phrases', 'version'}
    _missing = _REQUIRED_KEYS - set(_shared_config.keys())
    if _missing:
        raise RuntimeError(f"shared-safety-config.json missing required keys: {_missing}")
    DANGEROUS_PATTERNS = _shared_config['dangerous_phrases']
    HOMOGLYPH_MAP = _shared_config['homoglyph_map']
except (FileNotFoundError, json.JSONDecodeError, RuntimeError) as _e:
    print(f"SECURITY: Failed to load shared-safety-config.json ({_e}), prompt injection defenses may be incomplete.")
    DANGEROUS_PATTERNS = []
    HOMOGLYPH_MAP = {}

... 