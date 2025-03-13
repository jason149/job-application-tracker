from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from uuid import uuid4, UUID

app = FastAPI(title="Job Application Tracker")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic model for job application
class JobApplication(BaseModel):
    id: Optional[str] = None
    company: str
    position: str
    date_applied: date
    status: str
    notes: Optional[str] = None

# In-memory database
job_applications_db = []

@app.get("/")
def read_root():
    return {"message": "Welcome to Job Application Tracker API"}

@app.post("/applications/", response_model=JobApplication)
def create_application(application: JobApplication):
    if not application.id:
        application.id = str(uuid4())
    job_applications_db.append(application.dict())
    return application

@app.get("/applications/", response_model=List[JobApplication])
def read_applications(status: Optional[str] = None):
    if status:
        return [app for app in job_applications_db if app["status"].lower() == status.lower()]
    return job_applications_db

@app.get("/applications/{application_id}", response_model=JobApplication)
def read_application(application_id: str):
    for app in job_applications_db:
        if app["id"] == application_id:
            return app
    raise HTTPException(status_code=404, detail="Application not found")

@app.put("/applications/{application_id}", response_model=JobApplication)
def update_application(application_id: str, updated_application: JobApplication):
    for i, app in enumerate(job_applications_db):
        if app["id"] == application_id:
            # Preserve the original ID
            updated_data = updated_application.dict()
            updated_data["id"] = application_id
            job_applications_db[i] = updated_data
            return updated_data
    raise HTTPException(status_code=404, detail="Application not found")

@app.delete("/applications/{application_id}")
def delete_application(application_id: str):
    for i, app in enumerate(job_applications_db):
        if app["id"] == application_id:
            del job_applications_db[i]
            return {"message": "Application deleted successfully"}
    raise HTTPException(status_code=404, detail="Application not found")

# Get statistics about applications
@app.get("/statistics/")
def get_statistics():
    total = len(job_applications_db)
    
    # Count by status
    status_counts = {}
    for app in job_applications_db:
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