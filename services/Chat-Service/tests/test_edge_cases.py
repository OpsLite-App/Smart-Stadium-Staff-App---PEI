import pytest
from unittest.mock import MagicMock, patch
from main import on_message

# MQTT processor robustness test
def test_on_message_invalid_json(caplog):
    """Checks if the code handles invalid JSON coming from MQTT gracefully."""
    client = MagicMock()
    msg = MagicMock()
    msg.payload = b"isto-nao-e-json"
    msg.topic = "stadium/chat/1"
    
    # Execute the function (should not raise an exception externally)
    on_message(client, None, msg)
    
    # Verify that the error was properly logged
    assert "Error processing message" in caplog.text

# Database commit failure test
@patch("main.SessionLocal")
def test_on_message_db_error(mock_session_local, caplog):
    """Simulates a catastrophic DB failure during MQTT processing."""
    # Configure the mock to raise an error on commit
    mock_db = MagicMock()
    mock_db.commit.side_effect = Exception("Erro Crítico de Disco")
    mock_session_local.return_value = mock_db
    
    msg = MagicMock()
    msg.payload = b'{"room": "A", "sender_id": "1", "sender_name": "X", "text": "Ola"}'
    
    on_message(None, None, msg)
    
    # Ensure the session was closed even with an error (finally block)
    mock_db.close.assert_called_once()
    assert "Erro Crítico de Disco" in caplog.text

# Schema boundary test (Pydantic)
from schemas import ChatMessageCreate
from pydantic import ValidationError

def test_schema_field_types():
    """Checks that Pydantic enforces correct field types."""
    with pytest.raises(ValidationError):
        # Tenta passar um dicionário sem campos obrigatórios
        ChatMessageCreate(room="Sala")