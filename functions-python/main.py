from enum import Enum
from typing import Any

from firebase_admin import initialize_app
from firebase_functions import https_fn
from google.cloud import secretmanager
from livekit import api


class ApiKeys(Enum):
    LIVEKIT_API_KEY = 1
    LIVEKIT_API_SECRET = 2
    LIVEKIT_WEBSOCKET_URL = 3


paths = {
    ApiKeys.LIVEKIT_API_KEY: "projects/206700838957/secrets/LIVEKIT_API_KEY/versions/latest",
    ApiKeys.LIVEKIT_API_SECRET: "projects/206700838957/secrets/LIVEKIT_API_SECRET/versions/latest",
    ApiKeys.LIVEKIT_WEBSOCKET_URL: "projects/206700838957/secrets/LIVEKIT_WEBSOCKET_URL/versions/latest",
}

app = initialize_app()


def access_secret(client: secretmanager.SecretManagerServiceClient, key: ApiKeys) -> str:
    secret = client.access_secret_version(name=paths[key])
    return secret.payload.data.decode("UTF-8")


@https_fn.on_call()
def livekitToken(req: https_fn.CallableRequest) -> Any:
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication is required to create a LiveKit token.",
        )

    uid = req.auth.uid
    token_claims = req.auth.token or {}
    name = token_claims.get("name") or uid

    client = secretmanager.SecretManagerServiceClient()
    livekit_api_key_value = access_secret(client, ApiKeys.LIVEKIT_API_KEY)
    livekit_api_secret_value = access_secret(client, ApiKeys.LIVEKIT_API_SECRET)
    livekit_url_value = access_secret(client, ApiKeys.LIVEKIT_WEBSOCKET_URL)

    room_name = f"room_{uid}"
    token = (
        api.AccessToken(livekit_api_key_value, livekit_api_secret_value)
        .with_identity(uid)
        .with_name(name)
        .with_grants(
            api.VideoGrants(
                room_join=True,
                can_publish=True,
                can_publish_data=True,
                can_subscribe=True,
                can_update_own_metadata=True,
                room=room_name,
            )
        )
    )

    return {
        "accessToken": token.to_jwt(),
        "url": livekit_url_value,
        "room": room_name,
    }
