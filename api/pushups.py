from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import List, Optional
import cv2
import numpy as np
import mediapipe as mp
import base64
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
import json
from bson import json_util

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGODB_URL = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
client = AsyncIOMotorClient(MONGODB_URL)
db = client.pushup_counter
workouts_collection = db.workouts

# MediaPipe setup
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

# Global variables
counter = 0
stage = None
last_pushup_time = None

class PushupData(BaseModel):
    image_data: str
    timestamp: str

class WorkoutSession(BaseModel):
    user_id: str = "default_user"
    start_time: str
    end_time: Optional[str] = None
    total_pushups: int = 0
    pushup_data: List[dict] = []

# Helper functions
def calculate_angle(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians*180.0/np.pi)
    
    if angle > 180.0:
        angle = 360 - angle
    return angle

@app.post("/api/process_frame")
async def process_frame(data: PushupData):
    global counter, stage, last_pushup_time
    
    try:
        # Convert base64 image data to OpenCV format
        header, encoded = data.image_data.split(",", 1)
        image_data = base64.b64decode(encoded)
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Recolor image to RGB
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        
        # Make detection
        results = pose.process(image)
        
        # Recolor back to BGR
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
        
        # Extract landmarks
        try:
            landmarks = results.pose_landmarks.landmark
            
            # Get coordinates
            shoulder = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x, 
                       landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
            elbow = [landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].x, 
                    landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].y]
            wrist = [landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].x, 
                    landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].y]
            
            # Calculate angle
            angle = calculate_angle(shoulder, elbow, wrist)
            
            # Pushup counter logic
            if angle > 160:
                stage = "down"
            if angle < 90 and stage == 'down':
                stage = "up"
                counter += 1
                last_pushup_time = datetime.now().isoformat()
                
                # Save pushup data
                workout = await workouts_collection.find_one({"end_time": None})
                if not workout:
                    workout = WorkoutSession(
                        start_time=datetime.now().isoformat(),
                        total_pushups=1,
                        pushup_data=[{"count": counter, "timestamp": last_pushup_time}]
                    )
                    await workouts_collection.insert_one(workout.dict())
                else:
                    await workouts_collection.update_one(
                        {"_id": workout["_id"]},
                        {"$inc": {"total_pushups": 1}, 
                         "$push": {"pushup_data": {"count": counter, "timestamp": last_pushup_time}}}
                    )
            
            # Draw landmarks and angle
            cv2.putText(image, str(int(angle)), 
                        tuple(np.multiply(elbow, [640, 480]).astype(int)), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2, cv2.LINE_AA)
                        
        except Exception as e:
            print(f"Error processing landmarks: {e}")
        
        # Draw landmarks
        mp_drawing.draw_landmarks(
            image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
            mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=2),
            mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2)
        )
        
        # Draw counter
        cv2.putText(image, 'REPS', (15, 12), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
        cv2.putText(image, str(counter), 
                    (10, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 2, cv2.LINE_AA)
        
        # Stage
        cv2.putText(image, 'STAGE', (65, 12), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
        cv2.putText(image, stage, 
                    (60, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 2, cv2.LINE_AA)
        
        # Convert back to base64
        _, buffer = cv2.imencode('.jpg', image)
        processed_image = base64.b64encode(buffer).decode('utf-8')
        
        return {
            "processed_image": f"data:image/jpeg;base64,{processed_image}",
            "counter": counter,
            "stage": stage,
            "last_pushup_time": last_pushup_time
        }
        
    except Exception as e:
        print(f"Error in process_frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/start_workout")
async def start_workout():
    try:
        workout = WorkoutSession(
            start_time=datetime.now().isoformat(),
            total_pushups=0,
            pushup_data=[]
        )
        result = await workouts_collection.insert_one(workout.dict())
        return {"workout_id": str(result.inserted_id), "start_time": workout.start_time}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/end_workout/{workout_id}")
async def end_workout(workout_id: str):
    try:
        end_time = datetime.now().isoformat()
        result = await workouts_collection.update_one(
            {"_id": workout_id},
            {"$set": {"end_time": end_time}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Workout not found")
        return {"status": "success", "end_time": end_time}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workouts")
async def get_workouts():
    try:
        workouts = []
        async for workout in workouts_collection.find({"end_time": {"$ne": None}}).sort("start_time", -1):
            workout["_id"] = str(workout["_id"])
            workouts.append(workout)
        return workouts
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# This is required for Vercel
def handler(request):
    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Pushup Counter API"})
    }
