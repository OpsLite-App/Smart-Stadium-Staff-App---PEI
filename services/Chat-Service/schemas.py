from pydantic import BaseModel
import datetime

class ChatMessageBase(BaseModel):
    room: str
    sender_id: str
    sender_name: str
    text: str

class ChatMessageCreate(ChatMessageBase):
    pass

class ChatMessage(ChatMessageBase):
    id: int
    ts: datetime.datetime

    class Config:
        from_attributes = True
