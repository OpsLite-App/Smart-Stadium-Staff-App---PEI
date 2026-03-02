import json
import os
import threading
import logging
import paho.mqtt.client as mqtt
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models, schemas
from database import SessionLocal, engine, get_db

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow local frontend origins in development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MQTT settings from environment variables
MQTT_BROKER = os.getenv("MQTT_BROKER", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = "stadium/chat/#"

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logging.info("Connected to MQTT Broker!")
        client.subscribe(MQTT_TOPIC)
    else:
        logging.error(f"Failed to connect to MQTT Broker, return code {rc}\n")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode()
        logging.info(f"Received message on topic {msg.topic}: {payload}")
        data = json.loads(payload)

        db = SessionLocal()
        try:
            message_data = schemas.ChatMessageCreate(**data)
            db_message = models.ChatMessage(**message_data.dict())
            db.add(db_message)
            db.commit()
            logging.info(f"Stored message: {db_message.text}")
        finally:
            db.close()

    except Exception as e:
        logging.error(f"Error processing message: {e}")

def mqtt_client_thread():
    logging.info("MQTT client thread started.")
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
    client.on_connect = on_connect
    client.on_message = on_message
    
    logging.info(f"Connecting to MQTT broker at {MQTT_BROKER}:{MQTT_PORT}...")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
    except Exception as e:
        logging.error(f"Exception during MQTT connect: {e}")

    client.loop_forever()

@app.post("/messages", response_model=schemas.ChatMessage)
@app.post("/messages/", response_model=schemas.ChatMessage)
def create_message(message: schemas.ChatMessageCreate, db: Session = Depends(get_db)):
    db_message = models.ChatMessage(**message.dict())
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

@app.get("/messages/{room}/", response_model=list[schemas.ChatMessage])
@app.get("/messages/{room}", response_model=list[schemas.ChatMessage])
def get_messages_for_room(room: str, db: Session = Depends(get_db)):
    return db.query(models.ChatMessage).filter(models.ChatMessage.room == room).all()

# Start the MQTT client in a background thread
logging.info("Initializing MQTT client thread.")
mqtt_thread = threading.Thread(target=mqtt_client_thread)
mqtt_thread.daemon = True
mqtt_thread.start()
