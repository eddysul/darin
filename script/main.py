import asyncio
import json
import os
import ssl
from datetime import date
from io import BytesIO

import openai
import websockets
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment

load_dotenv()

BIZCRUSH_API_KEY = (os.getenv("BIZCRUSH_API_KEY") or "").strip()
OPENAI_API_KEY = (os.getenv("OPENAI_API_KEY") or "").strip()
CHUNK_SIZE = 640  # 20ms PCM16 at 16kHz mono

app = FastAPI(title="Darin Transcribe API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_openai_client: openai.OpenAI | None = None


def get_openai_client() -> openai.OpenAI:
    global _openai_client
    if _openai_client is None:
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")
        _openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)
    return _openai_client


CATEGORIZE_PROMPT = """
아래 텍스트는 육아 음성 메모를 전사한 내용이야.
이 내용을 분석해서 해당하는 카테고리의 이벤트 목록으로 만들어줘.

카테고리와 각 필드:
- 배변: time, type(대변/소변/혼합), color, note
- 식사: time, type(모유/분유/이유식), amount, note
- 수면: time_start, time_end, duration_min, note
- 키 몸무게의 변화: time, height_cm, weight_kg, note
- 목욕: time, note
- 진료: time, hospital, reason, note
- 온도/습도: time, body_temp, room_temp, humidity, note
- 영양제: time, name, amount, note
- 터미타임: time_start, duration_min, note
- 간식: time, type, amount, note
- 복용 약: time, name, amount, note

규칙:
- 텍스트에 언급된 내용만 이벤트로 만들 것
- 알 수 없는 필드는 null로 설정
- 시간은 HH:MM 형식으로, 아침/점심/저녁처럼 구체적 시간이 없으면 그대로 표현
- 반드시 아래 JSON 형식만 반환하고 다른 텍스트는 포함하지 말 것

{
  "events": [
    {
      "category": "카테고리명",
      ...해당 카테고리의 필드들
    }
  ]
}

전사 텍스트:
"""


async def transcribe(file_content: bytes) -> str:
    if not BIZCRUSH_API_KEY:
        raise HTTPException(status_code=500, detail="BIZCRUSH_API_KEY is not configured")

    audio = AudioSegment.from_file(BytesIO(file_content))
    audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    pcm_data = audio.raw_data

    wss_url = (
        f"wss://extapi.bizcrush.ai/v1/stt/stream"
        f"?api_key={BIZCRUSH_API_KEY}&format=json"
        f"&enable_diarization=false&language_hints=ko"
    )
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    final_text = ""
    async with websockets.connect(wss_url, ssl=ssl_ctx) as ws:
        await ws.send(json.dumps({"encoding": "pcm16"}))

        for i in range(0, len(pcm_data), CHUNK_SIZE):
            await ws.send(pcm_data[i:i + CHUNK_SIZE])
            await asyncio.sleep(0.02)

        await ws.send(b"")

        async for message in ws:
            data = json.loads(message)
            chunk = data.get("chunk", {})
            if chunk.get("text"):
                final_text = chunk["text"]

    return final_text


def categorize(text: str) -> dict:
    message = get_openai_client().chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=2048,
        messages=[{"role": "user", "content": CATEGORIZE_PROMPT + text}],
    )
    return json.loads(message.choices[0].message.content)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "bizcrush_configured": bool(BIZCRUSH_API_KEY),
        "openai_configured": bool(OPENAI_API_KEY),
    }


@app.post("/transcribe")
async def transcribe_recording(file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")

    text = await transcribe(content)
    result = categorize(text)
    result["date"] = date.today().isoformat()
    result["raw_text"] = text

    return result
