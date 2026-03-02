from sqlalchemy import Column, Integer, String, DateTime
from database import Base
import datetime

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    room = Column(String, index=True)
    sender_id = Column(String)
    sender_name = Column(String)
    text = Column(String)
    ts = Column(DateTime, default=datetime.datetime.utcnow)
