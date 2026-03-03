import pytest
import json
from unittest.mock import MagicMock, patch
from main import on_message

# Resilience test against invalid JSON
def test_on_message_with_corrupted_json(caplog):
    """
    Ensures the MQTT broker doesn't crash if it receives a non-JSON message.
    """
    mock_client = MagicMock()
    mock_msg = MagicMock()
    mock_msg.payload = b"nao_e_um_json_valido"  # Payload corrompido
    mock_msg.topic = "stadium/chat/geral"

    # The function should catch the exception internally and log the error
    on_message(mock_client, None, mock_msg)

    # Verifica se o erro foi registado nos logs
    assert "Error processing message" in caplog.text

# Integrity test: missing fields in MQTT
def test_on_message_missing_fields(caplog):
    """
    Checks that the system handles JSONs that don't match the schema properly.
    """
    mock_client = MagicMock()
    mock_msg = MagicMock()
    # JSON missing the 'text' field which is required by ChatMessageCreate
    payload = {"room": "sala1", "sender_id": "123", "sender_name": "User"}
    mock_msg.payload = json.dumps(payload).encode()
    mock_msg.topic = "stadium/chat/sala1"

    on_message(mock_client, None, mock_msg)

    assert "Error processing message" in caplog.text

# Safety test: DB session closure on critical error
@patch("main.SessionLocal")
def test_db_session_always_closes(mock_session_factory, caplog):
    """
    Ensures that the database connection is ALWAYS closed (db.close()), 
    even if an error occurs during commit.
    """
    # Create a mock session that raises an error when trying to commit
    mock_db_session = MagicMock()
    mock_db_session.commit.side_effect = Exception("Erro inesperado na DB")
    mock_session_factory.return_value = mock_db_session

    mock_msg = MagicMock()
    payload = {
        "room": "sala1", 
        "sender_id": "1", 
        "sender_name": "A", 
        "text": "Teste"
    }
    mock_msg.payload = json.dumps(payload).encode()
    mock_msg.topic = "stadium/chat/sala1"

    # Execute the function
    on_message(None, None, mock_msg)

    # Crucial check: was close() called despite the commit error?
    mock_db_session.close.assert_called_once()
    assert "Erro inesperado na DB" in caplog.text