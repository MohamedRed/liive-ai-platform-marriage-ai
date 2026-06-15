from livekit import api
from firebase_functions import https_fn, options, firestore_fn, logger
from google.cloud import secretmanager
from enum import Enum
from typing import Any
from firebase_admin import initialize_app, firestore, db
import google.cloud.firestore
import asyncio

class ApiKeys(Enum):
    OPENAI_API_KEY = 1
    LIVEKIT_API_KEY = 2
    LIVEKIT_API_SECRET = 3
    LIVEKIT_WEBSOCKET_URL = 4

paths = {
    ApiKeys.OPENAI_API_KEY: "projects/206700838957/secrets/OPENAI_API_KEY/versions/latest",
    ApiKeys.LIVEKIT_API_KEY: "projects/206700838957/secrets/LIVEKIT_API_KEY/versions/latest",
    ApiKeys.LIVEKIT_API_SECRET: "projects/206700838957/secrets/LIVEKIT_API_SECRET/versions/latest",
    ApiKeys.LIVEKIT_WEBSOCKET_URL: "projects/206700838957/secrets/LIVEKIT_WEBSOCKET_URL/versions/latest"
}

app = initialize_app()

@https_fn.on_call()
def livekitToken(req: https_fn.CallableRequest) -> Any:
  uid = req.auth.uid
  name = req.auth.token.get("name", "")
  picture = req.auth.token.get("picture", "")
  email = req.auth.token.get("email", "")

  client = secretmanager.SecretManagerServiceClient()
  livekit_api_key = client.access_secret_version(name=paths[ApiKeys.LIVEKIT_API_KEY])
  livekit_api_secret = client.access_secret_version(name=paths[ApiKeys.LIVEKIT_API_SECRET])
  livekit_url = client.access_secret_version(name=paths[ApiKeys.LIVEKIT_WEBSOCKET_URL])
  openai_api_key = client.access_secret_version(name=paths[ApiKeys.OPENAI_API_KEY])

  livekit_api_key_value=livekit_api_key.payload.data.decode('UTF-8')
  livekit_api_secret_value=livekit_api_secret.payload.data.decode('UTF-8')
  livekit_url_value=livekit_url.payload.data.decode('UTF-8')

  token = api.AccessToken(livekit_api_key_value, livekit_api_secret_value) \
    .with_identity(uid) \
    .with_name(name) \
    .with_grants(api.VideoGrants(
        room_join=True,
        can_publish=True,
        can_publish_data=True,
        can_subscribe=True,
        can_update_own_metadata=True,
        room="room_" + uid,
    ))

  return {
    "accessToken": token.to_jwt(),
    "url": livekit_url_value
  }
