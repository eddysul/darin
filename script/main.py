import asyncio
import json
import os
import ssl
from io import BytesIO

import websockets
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
from pydub import AudioSegment

load_dotenv()

BIZCRUSH_API_KEY = os.getenv("BIZCRUSH_API_KEY")
CHUNK_SIZE = 640  # 20ms PCM16 at 16kHz mono

app = FastAPI()


@app.post("/transcribe")
async def transcribe_recording(file: UploadFile = File(...)):
    content = await file.read()

    # m4a 등 포맷을 PCM16 (16kHz, mono, 16-bit)으로 변환
    audio = AudioSegment.from_file(BytesIO(content))
    audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
    pcm_data = audio.raw_data

    wss_url = (
        f"wss://extapi.bizcrush.ai/v1/stt/stream"
        f"?api_key={BIZCRUSH_API_KEY}&format=json"
        f"&enable_diarization=false&language_hints=ko"
    )
    final_text = ""
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    async with websockets.connect(wss_url, ssl=ssl_ctx) as ws:
        # 1. 설정 프레임 전송
        await ws.send(json.dumps({"encoding": "pcm16"}))

        # 2. 오디오 청크 스트리밍 (20ms 간격으로 실시간 페이싱)
        for i in range(0, len(pcm_data), CHUNK_SIZE):
            await ws.send(pcm_data[i:i + CHUNK_SIZE])
            await asyncio.sleep(0.02)

        # 3. 스트림 종료 신호: 빈 바이너리 프레임
        await ws.send(b"")

        # 4. 서버가 닫을 때까지 결과 수신 (text는 누적값이므로 마지막 값이 전체 텍스트)
        async for message in ws:
            print("RAW:", message)
            data = json.loads(message)
            chunk = data.get("chunk", {})
            if chunk.get("text"):
                final_text = chunk["text"]

    return {"text": final_text}
