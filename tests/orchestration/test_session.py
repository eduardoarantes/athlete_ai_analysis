"""
Tests for conversation session management.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from cycling_ai.orchestration.session import (
    ConversationMessage,
    ConversationSession,
    SessionManager,
)


class TestConversationMessage:
    """Tests for ConversationMessage dataclass."""

    def test_create_message(self) -> None:
        """Test creating a basic message."""
        msg = ConversationMessage(role="user", content="Hello")

        assert msg.role == "user"
        assert msg.content == "Hello"
        assert msg.tool_calls is None
        assert msg.tool_results is None
        assert isinstance(msg.timestamp, datetime)

    def test_message_with_tool_calls(self) -> None:
        """Test message with tool calls."""
        tool_calls = [{"name": "analyze_performance", "args": {"period": 6}}]
        msg = ConversationMessage(
            role="assistant", content="", tool_calls=tool_calls
        )

        assert msg.role == "assistant"
        assert msg.tool_calls == tool_calls

    def test_message_serialization(self) -> None:
        """Test message to/from dict conversion."""
        msg = ConversationMessage(
            role="user",
            content="Test message",
            tool_calls=[{"name": "test"}],
        )

        # Convert to dict
        msg_dict = msg.to_dict()
        assert msg_dict["role"] == "user"
        assert msg_dict["content"] == "Test message"
        assert msg_dict["tool_calls"] == [{"name": "test"}]
        assert "timestamp" in msg_dict

        # Convert back from dict
        msg2 = ConversationMessage.from_dict(msg_dict)
        assert msg2.role == msg.role
        assert msg2.content == msg.content
        assert msg2.tool_calls == msg.tool_calls


class TestConversationSession:
    """Tests for ConversationSession."""

    def test_create_session(self) -> None:
        """Test creating a conversation session."""
        session = ConversationSession(
            session_id="test-123", provider_name="anthropic"
        )

        assert session.session_id == "test-123"
        assert session.provider_name == "anthropic"
        assert len(session.messages) == 0
        assert isinstance(session.created_at, datetime)
        assert isinstance(session.last_activity, datetime)

    def test_add_message(self) -> None:
        """Test adding messages to session."""
        session = ConversationSession(
            session_id="test-123", provider_name="anthropic"
        )

        msg1 = ConversationMessage(role="user", content="Hello")
        session.add_message(msg1)

        assert len(session.messages) == 1
        assert session.messages[0].content == "Hello"

        msg2 = ConversationMessage(role="assistant", content="Hi there!")
        session.add_message(msg2)

        assert len(session.messages) == 2
        assert session.messages[1].content == "Hi there!"

    def test_last_activity_updates(self) -> None:
        """Test that last_activity updates when adding messages."""
        session = ConversationSession(
            session_id="test-123", provider_name="anthropic"
        )

        initial_activity = session.last_activity

        # Small delay to ensure timestamp difference
        import time
        time.sleep(0.01)

        msg = ConversationMessage(role="user", content="Test")
        session.add_message(msg)

        assert session.last_activity > initial_activity

    def test_get_messages_for_llm(self) -> None:
        """Test getting messages in LLM-compatible format."""
        session = ConversationSession(
            session_id="test-123", provider_name="anthropic"
        )

        session.add_message(ConversationMessage(role="user", content="Hello"))
        session.add_message(ConversationMessage(role="assistant", content="Hi!"))

        llm_messages = session.get_messages_for_llm()

        assert len(llm_messages) == 2
        assert llm_messages[0]["role"] == "user"
        assert llm_messages[0]["content"] == "Hello"
        assert llm_messages[1]["role"] == "assistant"
        assert llm_messages[1]["content"] == "Hi!"

    def test_get_messages_with_limit(self) -> None:
        """Test limiting number of messages returned."""
        session = ConversationSession(
            session_id="test-123", provider_name="anthropic"
        )

        # Add 5 messages
        for i in range(5):
            session.add_message(
                ConversationMessage(role="user", content=f"Message {i}")
            )

        # Get only last 2 messages
        llm_messages = session.get_messages_for_llm(max_messages=2)

        assert len(llm_messages) == 2
        assert llm_messages[0]["content"] == "Message 3"
        assert llm_messages[1]["content"] == "Message 4"

    def test_session_with_context(self) -> None:
        """Test session with context data."""
        context = {
            "athlete_profile": "/path/to/profile.json",
            "data_dir": "/path/to/data",
            "preferences": {"units": "metric"},
        }

        session = ConversationSession(
            session_id="test-123",
            provider_name="anthropic",
            context=context,
        )

        assert session.context["athlete_profile"] == "/path/to/profile.json"
        assert session.context["preferences"]["units"] == "metric"

    def test_session_serialization(self) -> None:
        """Test session to/from dict conversion."""
        session = ConversationSession(
            session_id="test-123",
            provider_name="anthropic",
            context={"key": "value"},
            model="claude-3-5-sonnet",
        )

        session.add_message(ConversationMessage(role="user", content="Test"))

        # Convert to dict
        session_dict = session.to_dict()
        assert session_dict["session_id"] == "test-123"
        assert session_dict["provider_name"] == "anthropic"
        assert session_dict["model"] == "claude-3-5-sonnet"
        assert len(session_dict["messages"]) == 1

        # Convert back from dict
        session2 = ConversationSession.from_dict(session_dict)
        assert session2.session_id == session.session_id
        assert session2.provider_name == session.provider_name
        assert session2.model == session.model
        assert len(session2.messages) == 1
        assert session2.messages[0].content == "Test"


class TestSessionManager:
    """Tests for SessionManager."""

    def test_create_session_manager(self, tmp_path: Path) -> None:
        """Test creating session manager."""
        manager = SessionManager(storage_dir=tmp_path)
        assert manager._storage_dir == tmp_path
        assert tmp_path.exists()

    def test_create_session_manager_in_memory(self) -> None:
        """Test creating in-memory session manager."""
        manager = SessionManager(storage_dir=None)
        assert manager._storage_dir is None
        assert len(manager._sessions) == 0

    def test_create_new_session(self, tmp_path: Path) -> None:
        """Test creating a new session."""
        manager = SessionManager(storage_dir=tmp_path)

        session = manager.create_session(
            provider_name="anthropic",
            context={"key": "value"},
            model="claude-3-5-sonnet",
        )

        assert session.session_id is not None
        assert session.provider_name == "anthropic"
        assert session.model == "claude-3-5-sonnet"
        assert session.context["key"] == "value"

    def test_create_session_with_system_prompt(self, tmp_path: Path) -> None:
        """Test creating session with system prompt."""
        manager = SessionManager(storage_dir=tmp_path)

        system_prompt = "You are a cycling performance analyst."
        session = manager.create_session(
            provider_name="anthropic",
            system_prompt=system_prompt,
        )

        assert len(session.messages) == 1
        assert session.messages[0].role == "system"
        assert session.messages[0].content == system_prompt

    def test_get_session(self, tmp_path: Path) -> None:
        """Test retrieving a session."""
        manager = SessionManager(storage_dir=tmp_path)

        session = manager.create_session(provider_name="anthropic")
        session_id = session.session_id

        # Retrieve session
        retrieved = manager.get_session(session_id)
        assert retrieved.session_id == session_id
        assert retrieved.provider_name == "anthropic"

    def test_get_nonexistent_session(self, tmp_path: Path) -> None:
        """Test retrieving a session that doesn't exist."""
        manager = SessionManager(storage_dir=tmp_path)

        with pytest.raises(KeyError, match="not found"):
            manager.get_session("nonexistent-id")

    def test_update_session(self, tmp_path: Path) -> None:
        """Test updating a session."""
        manager = SessionManager(storage_dir=tmp_path)

        session = manager.create_session(provider_name="anthropic")
        session.add_message(ConversationMessage(role="user", content="Test"))

        manager.update_session(session)

        # Retrieve and verify
        retrieved = manager.get_session(session.session_id)
        assert len(retrieved.messages) == 1
        assert retrieved.messages[0].content == "Test"

    def test_list_sessions(self, tmp_path: Path) -> None:
        """Test listing all sessions."""
        manager = SessionManager(storage_dir=tmp_path)

        # Create 3 sessions
        session1 = manager.create_session(provider_name="anthropic")
        session2 = manager.create_session(provider_name="openai")
        session3 = manager.create_session(provider_name="anthropic")

        # List all sessions
        sessions = manager.list_sessions()
        assert len(sessions) == 3

        # List by provider
        anthropic_sessions = manager.list_sessions(provider_name="anthropic")
        assert len(anthropic_sessions) == 2

        openai_sessions = manager.list_sessions(provider_name="openai")
        assert len(openai_sessions) == 1

    def test_list_sessions_sorted_by_activity(self, tmp_path: Path) -> None:
        """Test that sessions are sorted by last activity."""
        manager = SessionManager(storage_dir=tmp_path)

        # Create sessions with different activity times
        session1 = manager.create_session(provider_name="anthropic")
        import time
        time.sleep(0.01)
        session2 = manager.create_session(provider_name="anthropic")
        time.sleep(0.01)
        session3 = manager.create_session(provider_name="anthropic")

        sessions = manager.list_sessions()

        # Most recent should be first
        assert sessions[0].session_id == session3.session_id
        assert sessions[1].session_id == session2.session_id
        assert sessions[2].session_id == session1.session_id

    def test_list_sessions_with_limit(self, tmp_path: Path) -> None:
        """Test limiting number of sessions returned."""
        manager = SessionManager(storage_dir=tmp_path)

        # Create 5 sessions
        for _ in range(5):
            manager.create_session(provider_name="anthropic")

        # Get only 2 most recent
        sessions = manager.list_sessions(limit=2)
        assert len(sessions) == 2

    def test_delete_session(self, tmp_path: Path) -> None:
        """Test deleting a session."""
        manager = SessionManager(storage_dir=tmp_path)

        session = manager.create_session(provider_name="anthropic")
        session_id = session.session_id

        # Verify session exists
        assert manager.get_session(session_id) is not None

        # Delete session
        manager.delete_session(session_id)

        # Verify session is gone
        with pytest.raises(KeyError):
            manager.get_session(session_id)

    def test_session_persistence(self, tmp_path: Path) -> None:
        """Test that sessions are persisted to disk."""
        manager1 = SessionManager(storage_dir=tmp_path)

        # Create session with messages
        session = manager1.create_session(provider_name="anthropic")
        session.add_message(ConversationMessage(role="user", content="Test"))
        manager1.update_session(session)

        session_id = session.session_id

        # Create new manager (simulates restart)
        manager2 = SessionManager(storage_dir=tmp_path)

        # Should load existing session
        loaded_session = manager2.get_session(session_id)
        assert loaded_session.session_id == session_id
        assert len(loaded_session.messages) == 1
        assert loaded_session.messages[0].content == "Test"

    def test_in_memory_no_persistence(self) -> None:
        """Test that in-memory manager doesn't persist."""
        manager = SessionManager(storage_dir=None)

        session = manager.create_session(provider_name="anthropic")
        session_id = session.session_id

        # Create new manager - should not find session
        manager2 = SessionManager(storage_dir=None)

        with pytest.raises(KeyError):
            manager2.get_session(session_id)

    def test_corrupted_session_file_handling(self, tmp_path: Path) -> None:
        """Test handling of corrupted session files."""
        manager = SessionManager(storage_dir=tmp_path)

        # Create a corrupted session file
        corrupted_file = tmp_path / "corrupted-session.json"
        corrupted_file.write_text("{invalid json}")

        # Should handle gracefully and not crash
        sessions = manager.list_sessions()
        # Corrupted file should be ignored
        assert len(sessions) == 0

    def test_session_file_creation(self, tmp_path: Path) -> None:
        """Test that session files are created correctly."""
        manager = SessionManager(storage_dir=tmp_path)

        session = manager.create_session(provider_name="anthropic")
        session_id = session.session_id

        # Check file exists
        session_file = tmp_path / f"{session_id}.json"
        assert session_file.exists()

        # Verify file contents
        with open(session_file) as f:
            data = json.load(f)

        assert data["session_id"] == session_id
        assert data["provider_name"] == "anthropic"

    def test_delete_session_removes_file(self, tmp_path: Path) -> None:
        """Test that deleting session removes file."""
        manager = SessionManager(storage_dir=tmp_path)

        session = manager.create_session(provider_name="anthropic")
        session_id = session.session_id
        session_file = tmp_path / f"{session_id}.json"

        # Verify file exists
        assert session_file.exists()

        # Delete session
        manager.delete_session(session_id)

        # Verify file is gone
        assert not session_file.exists()
