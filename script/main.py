import os
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles

load_dotenv()

BIZCRUSH_API_KEY = os.getenv("BIZCRUSH_API_KEY")
BASE_URL = os.getenv("BASE_URL")  # 서버 공개 URL (예: https://your-server.com)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI()
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.post("/transcribe")
async def transcribe_recording(file: UploadFile = File(...)):
    # 파일 임시 저장
    ext = Path(file.filename).suffix if file.filename else ".m4a"
    filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / filename

    file_path.write_bytes(await file.read())

    audio_url = f"{BASE_URL}/uploads/{filename}"

    try:
        async with httpx.AsyncClient(timeout=600) as client:
            response = await client.post(
                "https://extapi.bizcrush.ai/v1/stt",
                params={"api_key": BIZCRUSH_API_KEY},
                json={"audio_url": audio_url},
            )
    finally:
        file_path.unlink(missing_ok=True)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.json())

    return response.json()
