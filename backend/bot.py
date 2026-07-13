import os
import uvicorn
from fastapi import FastAPI, WebSocket, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Connect

import logging
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.pipeline.runner import PipelineRunner
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.services.openai import OpenAILLMService
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.transports.network.fastapi_websocket import (
    FastAPIWebsocketTransport,
    FastAPIWebsocketParams,
)
from pipecat.serializers.twilio import TwilioFrameSerializer

import json

load_dotenv()
logger = logging.getLogger("telephony-agent")
logging.basicConfig(level=logging.INFO)

def get_api_key(key_name: str, env_fallback: str) -> str:
    try:
        with open("settings.json", "r") as f:
            settings = json.load(f)
            if key_name in settings and settings[key_name]:
                return settings[key_name]
    except FileNotFoundError:
        pass
    return os.getenv(env_fallback)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class OutboundCallRequest(BaseModel):
    phone_number: str

@app.post("/api/outbound-call")
async def make_outbound_call(req: OutboundCallRequest):
    try:
        sid = get_api_key("twilio_account_sid", "TWILIO_ACCOUNT_SID")
        token = get_api_key("twilio_auth_token", "TWILIO_AUTH_TOKEN")
        phone = get_api_key("twilio_phone_number", "TWILIO_PHONE_NUMBER")
        twilio_client = Client(sid, token)
        
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        
        call = twilio_client.calls.create(
            to=req.phone_number,
            from_=phone,
            url=f"{base_url}/twiml"
        )
        return {"status": "success", "call_sid": call.sid}
    except Exception as e:
        logger.error(f"Error calling: {e}")
        return {"error": str(e)}

@app.post("/twiml")
async def twiml_endpoint(request: Request):
    response = VoiceResponse()
    connect = Connect()
    
    base_url = os.getenv("BASE_URL", "http://localhost:8000")
    ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://") + "/ws"
    
    connect.stream(url=ws_url)
    response.append(connect)
    return Response(content=str(response), media_type="application/xml")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_out_enabled=True,
            add_wav_header=False,
            vad_enabled=True,
            vad_analyzer=None,
            vad_audio_passthrough=True,
            serializer=TwilioFrameSerializer("dummy_sid"),
        ),
    )

    provider = get_api_key("llm_provider", "LLM_PROVIDER") or "gpt-4o"
    
    if provider.startswith("gpt"):
        llm = OpenAILLMService(api_key=get_api_key("openai_api_key", "OPENAI_API_KEY"), model=provider)
    elif provider.startswith("gemini"):
        llm = OpenAILLMService(
            api_key=get_api_key("gemini_api_key", "GEMINI_API_KEY"),
            model=provider.replace("gemini/", ""),
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
    elif provider.startswith("zhipu"):
        llm = OpenAILLMService(
            api_key=get_api_key("glm_api_key", "ZHIPUAI_API_KEY"),
            model=provider.replace("zhipu/", ""),
            base_url="https://open.bigmodel.cn/api/paas/v4/"
        )
    elif provider.startswith("claude"):
        try:
            from pipecat.services.anthropic import AnthropicLLMService
            llm = AnthropicLLMService(
                api_key=get_api_key("anthropic_api_key", "ANTHROPIC_API_KEY"),
                model=provider
            )
        except ImportError:
            llm = OpenAILLMService(api_key=get_api_key("openai_api_key", "OPENAI_API_KEY"), model="gpt-4o")
    else:
        llm = OpenAILLMService(api_key=get_api_key("openai_api_key", "OPENAI_API_KEY"), model="gpt-4o")
    stt = DeepgramSTTService(api_key=get_api_key("deepgram_api_key", "DEEPGRAM_API_KEY"))
    tts = ElevenLabsTTSService(
        api_key=get_api_key("elevenlabs_api_key", "ELEVENLABS_API_KEY"), 
        voice_id=get_api_key("elevenlabs_voice_id", "ELEVENLABS_VOICE_ID") or "21m00Tcm4TlvDq8ikWAM"
    )

    messages = [
        {
            "role": "system",
            "content": "You are a highly capable AI telephony assistant. Keep your answers brief, polite, and conversational.",
        }
    ]

    pipeline = Pipeline([
        transport.input(),
        stt,
        llm,
        tts,
        transport.output(),
    ])

    task = PipelineTask(pipeline, params=PipelineParams(allow_interruptions=True))

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        messages.append({"role": "system", "content": "Please greet the user."})
        await task.queue_frames([llm.create_context_frame(messages)])

    runner = PipelineRunner()
    await runner.run(task)

class ApiKeysUpdate(BaseModel):
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    glm_api_key: str = ""
    llm_provider: str = "gpt-4o"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    elevenlabs_api_key: str = ""
    deepgram_api_key: str = ""

@app.post("/api/settings/keys")
async def update_keys(req: ApiKeysUpdate):
    settings = {}
    try:
        with open("settings.json", "r") as f:
            settings = json.load(f)
    except FileNotFoundError:
        pass
    
    for k, v in req.model_dump().items():
        if v:
            settings[k] = v
            
    with open("settings.json", "w") as f:
        json.dump(settings, f)
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run("bot:app", host="0.0.0.0", port=8006, reload=True)
