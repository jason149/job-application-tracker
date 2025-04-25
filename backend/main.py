from fastapi import FastAPI, HTTPException, Depends, Form, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from uuid import uuid4
from pymongo import MongoClient
from passlib.context import CryptContext
import os
from starlette.middleware.sessions import SessionMiddleware

# Initialize FastAPI
app = FastAPI(title="Job Application Tracker")

# Add session middleware
app.add_middleware(SessionMiddleware, secret_key="your-secret-key-for-development")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Connection
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/jobapp_tracker")
client = MongoClient(MONGO_URI)
db = client.job_tracker
users_collection = db.users
applications_collection = db.applications

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Pydantic models
class User(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class JobApplication(BaseModel):
    id: Optional[str] = None
    company: str
    position: str
    date_applied: date
    status: str
    notes: Optional[str] = None
    user_id: Optional[str] = None

# Helper functions
def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def authenticate_user(username: str, password: str):
    user = users_collection.find_one({"username": username})
    if not user:
        return False
    if not verify_password(password, user["password"]):
        return False
    return user

# Dependency to get current user
async def get_current_user(request: Request):
    username = request.session.get("username")
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

@app.get("/")
def read_root():
    return {"message": "Welcome to Job Application Tracker API"}

# Auth routes
@app.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    # Set session data
    request.session["username"] = username
    request.session["user_id"] = str(user["_id"])
    
    return {"message": "Login successful"}

@app.post("/register")
async def register(user: User):
    # Check if username exists
    if users_collection.find_one({"username": user.username}):
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create user
    hashed_password = hash_password(user.password)
    user_data = {
        "username": user.username,
        "password": hashed_password,
        "email": user.email,
        "created_at": date.today().isoformat()
    }
    
    result = users_collection.insert_one(user_data)
    return {"message": "User registered successfully"}

@app.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"message": "Logout successful"}

@app.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user["username"],
        "email": current_user.get("email", "")
    }

# Application CRUD
@app.post("/applications/", response_model=JobApplication)
def create_application(application: JobApplication, current_user: dict = Depends(get_current_user)):
    if not application.id:
        application.id = str(uuid4())
    
    # Link application to user
    application_data = application.dict()
    application_data["user_id"] = str(current_user["_id"])
    
    # Insert into MongoDB
    applications_collection.insert_one(application_data)
    
    return application

@app.get("/applications/", response_model=List[JobApplication])
def read_applications(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    # Build query
    query = {"user_id": str(current_user["_id"])}
    if status:
        query["status"] = {"$regex": status, "$options": "i"}
    
    # Fetch user's applications
    user_applications = list(applications_collection.find(query))
    
    # Convert MongoDB documents to Pydantic models
    return [JobApplication(**app) for app in user_applications]

@app.get("/applications/{application_id}", response_model=JobApplication)
def read_application(application_id: str, current_user: dict = Depends(get_current_user)):
    # Fetch specific application for this user
    application = applications_collection.find_one({
        "id": application_id,
        "user_id": str(current_user["_id"])
    })
    
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return JobApplication(**application)

@app.put("/applications/{application_id}", response_model=JobApplication)
def update_application(application_id: str, updated_application: JobApplication, current_user: dict = Depends(get_current_user)):
    # Check if application exists and belongs to user
    existing_application = applications_collection.find_one({
        "id": application_id,
        "user_id": str(current_user["_id"])
    })
    
    if not existing_application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Update application
    updated_data = updated_application.dict(exclude_unset=True)
    updated_data["id"] = application_id
    updated_data["user_id"] = str(current_user["_id"])
    
    applications_collection.update_one(
        {"id": application_id, "user_id": str(current_user["_id"])},
        {"$set": updated_data}
    )
    
    # Get updated application
    updated_app = applications_collection.find_one({
        "id": application_id,
        "user_id": str(current_user["_id"])
    })
    
    return JobApplication(**updated_app)

@app.delete("/applications/{application_id}")
def delete_application(application_id: str, current_user: dict = Depends(get_current_user)):
    # Check if application exists and belongs to user
    existing_application = applications_collection.find_one({
        "id": application_id,
        "user_id": str(current_user["_id"])
    })
    
    if not existing_application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Delete application
    applications_collection.delete_one({"id": application_id, "user_id": str(current_user["_id"])})
    
    return {"message": "Application deleted successfully"}

# Get statistics about applications
@app.get("/statistics/")
def get_statistics(current_user: dict = Depends(get_current_user)):
    # Get applications for this user
    user_applications = list(applications_collection.find({"user_id": str(current_user["_id"])}))
    
    total = len(user_applications)
    
    # Count by status
    status_counts = {}
    for app in user_applications:
        status = app["status"]
        if status in status_counts:
            status_counts[status] += 1
        else:
            status_counts[status] = 1
    
    return {
        "total_applications": total,
        "status_counts": status_counts
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
