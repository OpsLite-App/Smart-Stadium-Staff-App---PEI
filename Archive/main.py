import cv2
import numpy as np
import onnxruntime as ort
import paho.mqtt.client as mqtt
import json, uuid, os
from datetime import datetime

# EBC model normalization constants from the original implementation
MEAN = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
STD = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)

def preprocess_image(frame, target_size=(448, 448)):
    # Resize image to model's expected input size
    image = cv2.resize(frame, target_size)
    
    # Convert BGR to RGB
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Convert to float and normalize to [0, 1]
    image = image.astype(np.float32) / 255.0
    
    # Apply EBC models normalization
    image = (image - MEAN.reshape(1, 1, 3)) / STD.reshape(1, 1, 3)
    
    # Convert from HWC to CHW format
    image = image.transpose(2, 0, 1)
    
    # Add batch dimension
    image = np.expand_dims(image, axis=0)
    
    return image

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT   = int(os.getenv("MQTT_PORT", 1883))
AREA_ID     = os.getenv("AREA_ID", "N17")  # node ID da zona monitorizada
CAPACITY    = int(os.getenv("CAPACITY", 150))

def main():
    # 1. Load the ONNX model
    model_path = "model/zip_n_model_quant.onnx"
    session = ort.InferenceSession(model_path)

    # MQTT
    mqtt_client = mqtt.Client()
    mqtt_client.connect(MQTT_BROKER, MQTT_PORT)
    mqtt_client.loop_start()
    
    input_name = session.get_inputs()[0].name
    input_shape = session.get_inputs()[0].shape
    
    # Determine input size
    if len(input_shape) == 4 and all(isinstance(dim, int) for dim in input_shape[2:]):
        h, w = input_shape[2], input_shape[3]
    else:
        h, w = 448, 448  # Default for EBC models on SHA dataset (ussually 448x448)
    
    print(f"Model input size: {w}x{h}")
    print(f"Model expects input: {input_shape}")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        # Fallback: use static image for testing without camera
        print("⚠️  No camera found, using static image for testing")
        frame = cv2.imread(os.path.join(os.path.dirname(__file__), "resources/025.jpg"))
        if frame is None:
            print("❌ No image found either, exiting")
            return
        blob = preprocess_image(frame, target_size=(w, h))
        outputs = session.run(None, {input_name: blob})
        density_map = outputs[0][0][0]
        count = int(round(np.sum(density_map)))
        occupancy = min(round(count / CAPACITY * 100, 1), 100.0)
        event = {
            "event_id":      str(uuid.uuid4()),
            "event_type":    "crowd_density",
            "timestamp":     datetime.now().isoformat() + "Z",
            "area_id":       AREA_ID,
            "area_type":     "normal",
            "current_count": count,
            "capacity":      CAPACITY,
            "occupancy_rate": occupancy,
            "heat_level":    "green" if occupancy < 50 else "yellow" if occupancy < 80 else "red",
        }
        mqtt_client.publish("stadium/crowd/density-updates", json.dumps(event))
        print(f"→ {AREA_ID}: {count} pessoas ({occupancy}%)")
        return
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: 
            break

        # 2. Pre-processing using EBC models expected format
        blob = preprocess_image(frame, target_size=(w, h))

        # 3. Run Inference
        try:
            outputs = session.run(None, {input_name: blob})
            density_map = outputs[0][0][0]  # Shape: [Height, Width]
        except Exception as e:
            print(f"Inference error: {e}")
            continue

        # 4. Calculate Crowd Count
        count = int(round(np.sum(density_map)))

        # Publish to MQTT
        occupancy = min(round(count / CAPACITY * 100, 1), 100.0)
        event = {
            "event_id":      str(uuid.uuid4()),
            "event_type":    "crowd_density",
            "timestamp":     datetime.now().isoformat() + "Z",
            "area_id":       AREA_ID,
            "area_type":     "normal",
            "current_count": count,
            "capacity":      CAPACITY,
            "occupancy_rate": occupancy,
            "heat_level":    "green" if occupancy < 50 else "yellow" if occupancy < 80 else "red",
        }
        mqtt_client.publish("stadium/crowd/density-updates", json.dumps(event))
        print(f"→ {AREA_ID}: {count} pessoas ({occupancy}%)")

        # 5. Generate Heatmap Visualization
        # Resize density map to match original frame size for visualization
        density_resized = cv2.resize(density_map, (frame.shape[1], frame.shape[0]))
        
        # Normalize density map for visualization (handle edge case of all zeros)
        if density_resized.max() > density_resized.min():
            vis_map = (density_resized - density_resized.min()) / (density_resized.max() - density_resized.min())
        else:
            vis_map = np.zeros_like(density_resized)
        
        vis_map = (vis_map * 255).astype(np.uint8)
        
        # Apply Jet colormap (Blue = Low, Red = High density)
        heatmap = cv2.applyColorMap(vis_map, cv2.COLORMAP_JET)

        # 6. Overlay Heatmap on Original Feed
        result = cv2.addWeighted(frame, 0.6, heatmap, 0.4, 0)

        # 7. Draw Counter and Model Info
        # Background for text
        cv2.rectangle(result, (0, 0), (300, 80), (0, 0, 0), -1)
        
        # Count display
        cv2.putText(result, f"Count: {count}", (10, 35), 
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        # Model info
        cv2.putText(result, f"Input: {w}x{h}", (10, 65), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

        cv2.imshow('EBC Crowd Counting - Real-time', result)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()