"""
Conversation session management.

Manages multi-turn conversation state, message history, and context
for LLM-powered conversational interface.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


def _deep_serialize(obj: Any) -> Any:
    """
    Recursively serialize an object to JSON-compatible format.
    Handles nested dicts, lists, and protobuf objects.
    """
    if obj is None:
        return None

    # Try direct JSON serialization first
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        pass

    # Handle dict
    if isinstance(obj, dict):
        result = {}
        for key, value in obj.items():
            result[key] = _deep_serialize(value)
        return result

    # Handle list or tuple
    if isinstance(obj, (list, tuple)):
        return [_deep_serialize(item) for item in obj]

    # Try to convert iterables like RepeatedComposite
    try:
        if hasattr(obj, '__iter__') and not isinstance(obj, str):
            return [_deep_serialize(item) for item in obj]
    except (TypeError, AttributeError):
        pass

    # Fallback: convert to string
    return str(obj)


@dataclass
class ConversationMessage:
    """
    Single message in a conversation.

    Represents a message from user, assistant, system, or tool execution.
    """

    role: str  # "user", "assistant", "system", "tool"
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_results: list[dict[str, Any]] | None = None
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "role": self.role,
            "content": self.content,
            "tool_calls": _deep_serialize(self.tool_calls),
            "tool_results": _deep_serialize(self.tool_results),
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ConversationMessage:
        """Create from dictionary."""
        return cls(
            role=data["role"],
            content=data["content"],
            tool_calls=data.get("tool_calls"),
            tool_results=data.get("tool_results"),
            timestamp=datetime.fromisoformat(data["timestamp"]),
        )


@dataclass
class ConversationSession:
    """
    Manages a conversation session.

    Tracks conversation history, context, and metadata for a single
    conversational session with an LLM.
    """

    session_id: str
    provider_name: str
    messages: list[ConversationMessage] = field(default_factory=list)
    context: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    model: str | None = None

    def add_message(self, message: ConversationMessage) -> None:
        """
        Add message to conversation history.

        Args:
            message: Message to add
        """
        self.messages.append(message)
        self.last_activity = datetime.now()

    def get_messages_for_llm(self, max_messages: int | None = None) -> list[dict[str, Any]]:
        """
        Get messages formatted for LLM provider.

        Args:
            max_messages: Maximum number of recent messages to include

        Returns:
            List of message dictionaries suitable for LLM API
        """
        messages_to_include = self.messages
        if max_messages is not None and len(messages_to_include) > max_messages:
            messages_to_include = messages_to_include[-max_messages:]

        llm_messages = []
        for msg in messages_to_include:
            # Convert to LLM-compatible format
            llm_msg: dict[str, Any] = {
                "role": msg.role,
                "content": msg.content,
            }

            # Add tool calls if present
            if msg.tool_calls:
                llm_msg["tool_calls"] = msg.tool_calls

            # Add tool results if present (for tool role messages)
            if msg.tool_results:
                llm_msg["tool_results"] = msg.tool_results

            llm_messages.append(llm_msg)

        return llm_messages

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "session_id": self.session_id,
            "provider_name": self.provider_name,
            "messages": [msg.to_dict() for msg in self.messages],
            "context": self.context,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "model": self.model,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ConversationSession:
        """Create from dictionary."""
        return cls(
            session_id=data["session_id"],
            provider_name=data["provider_name"],
            messages=[ConversationMessage.from_dict(msg) for msg in data["messages"]],
            context=data["context"],
            created_at=datetime.fromisoformat(data["created_at"]),
            last_activity=datetime.fromisoformat(data["last_activity"]),
            model=data.get("model"),
        )


class SessionManager:
    """
    Manages conversation sessions.

    Handles creation, retrieval, persistence, and cleanup of conversation
    sessions. Supports both in-memory and file-based persistence.
    """

    def __init__(self, storage_dir: Path | None = None):
        """
        Initialize session manager.

        Args:
            storage_dir: Directory for session persistence (None for in-memory only)
        """
        self._sessions: dict[str, ConversationSession] = {}
        self._storage_dir = storage_dir

        if self._storage_dir:
            self._storage_dir.mkdir(parents=True, exist_ok=True)
            self._load_existing_sessions()

    def create_session(
        self,
        provider_name: str,
        context: dict[str, Any] | None = None,
        model: str | None = None,
        system_prompt: str | None = None,
    ) -> ConversationSession:
        """
        Create new conversation session.

        Args:
            provider_name: Name of LLM provider
            context: Initial context (e.g., data paths, athlete info)
            model: Specific model to use
            system_prompt: System prompt to set conversation context

        Returns:
            New conversation session
        """
        session_id = str(uuid.uuid4())
        session = ConversationSession(
            session_id=session_id,
            provider_name=provider_name,
            context=context or {},
            model=model,
        )

        # Add system message if provided
        if system_prompt:
            session.add_message(
                ConversationMessage(role="system", content=system_prompt)
            )

        self._sessions[session_id] = session
        self._persist_session(session)

        return session

    def get_session(self, session_id: str) -> ConversationSession:
        """
        Retrieve session by ID.

        Args:
            session_id: Session identifier

        Returns:
            Conversation session

        Raises:
            KeyError: If session not found
        """
        if session_id not in self._sessions:
            # Try loading from disk
            if self._storage_dir:
                session = self._load_session_from_disk(session_id)
                if session:
                    self._sessions[session_id] = session
                    return session

            raise KeyError(f"Session {session_id} not found")

        return self._sessions[session_id]

    def update_session(self, session: ConversationSession) -> None:
        """
        Update session and persist changes.

        Args:
            session: Session to update
        """
        session.last_activity = datetime.now()
        self._sessions[session.session_id] = session
        self._persist_session(session)

    def list_sessions(
        self, provider_name: str | None = None, limit: int | None = None
    ) -> list[ConversationSession]:
        """
        List all active sessions.

        Args:
            provider_name: Filter by provider (None for all)
            limit: Maximum number of sessions to return

        Returns:
            List of conversation sessions, sorted by last activity
        """
        sessions = list(self._sessions.values())

        # Filter by provider if specified
        if provider_name:
            sessions = [s for s in sessions if s.provider_name == provider_name]

        # Sort by last activity (most recent first)
        sessions.sort(key=lambda s: s.last_activity, reverse=True)

        # Apply limit
        if limit:
            sessions = sessions[:limit]

        return sessions

    def get_session_file_path(self, session_id: str) -> Path | None:
        """
        Get file path for a session.

        Args:
            session_id: Session identifier

        Returns:
            Path to session file if storage is configured and file exists, None otherwise
        """
        if not self._storage_dir:
            return None

        session_file = self._storage_dir / f"{session_id}.json"
        return session_file if session_file.exists() else None

    def delete_session(self, session_id: str) -> None:
        """
        Delete session.

        Args:
            session_id: Session identifier
        """
        if session_id in self._sessions:
            del self._sessions[session_id]

        # Delete from disk if persisted
        if self._storage_dir:
            session_file = self._storage_dir / f"{session_id}.json"
            if session_file.exists():
                session_file.unlink()

    def _persist_session(self, session: ConversationSession) -> None:
        """Persist session to disk if storage configured."""
        if not self._storage_dir:
            return

        session_file = self._storage_dir / f"{session.session_id}.json"
        with open(session_file, "w") as f:
            json.dump(session.to_dict(), f, indent=2)

    def _load_session_from_disk(self, session_id: str) -> ConversationSession | None:
        """Load session from disk if it exists."""
        if not self._storage_dir:
            return None

        session_file = self._storage_dir / f"{session_id}.json"
        if not session_file.exists():
            return None

        try:
            with open(session_file) as f:
                data = json.load(f)
            return ConversationSession.from_dict(data)
        except (json.JSONDecodeError, KeyError, ValueError):
            # Corrupted session file, ignore it
            return None

    def _load_existing_sessions(self) -> None:
        """Load all existing sessions from disk on startup."""
        if not self._storage_dir or not self._storage_dir.exists():
            return

        for session_file in self._storage_dir.glob("*.json"):
            try:
                with open(session_file) as f:
                    data = json.load(f)
                session = ConversationSession.from_dict(data)
                self._sessions[session.session_id] = session
            except (json.JSONDecodeError, KeyError, ValueError):
                # Corrupted session file, skip it
                continue


def get_default_session_manager() -> SessionManager:
    """
    Get default session manager instance.

    Stores sessions in user's home directory under .cycling-ai/sessions/

    Returns:
        Session manager instance
    """
    storage_dir = Path.home() / ".cycling-ai" / "sessions"
    return SessionManager(storage_dir=storage_dir)
