from enum import Enum
from typing import Any

from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn
from google.cloud import secretmanager
from livekit import api

from video_authorization import (
    MatchVideoAuthorizationError,
    authorize_supervised_video_room,
    parse_supervised_video_request,
)


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
MATCHES_COLLECTION = "MATCHES"


def _failed_precondition(message: str) -> https_fn.HttpsError:
    return https_fn.HttpsError(
        code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
        message=message,
    )


def _invalid_argument(message: str) -> https_fn.HttpsError:
    return https_fn.HttpsError(
        code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
        message=message,
    )


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

    try:
        match_id = parse_supervised_video_request(req.data)
    except MatchVideoAuthorizationError as exc:
        raise _invalid_argument(str(exc)) from exc

    match_snapshot = firestore.client().collection(MATCHES_COLLECTION).document(uid).get()
    match_document = match_snapshot.to_dict() if match_snapshot.exists else None

    try:
        authorization = authorize_supervised_video_room(uid, match_id, match_document)
    except MatchVideoAuthorizationError as exc:
        raise _failed_precondition(str(exc)) from exc

    client = secretmanager.SecretManagerServiceClient()
    livekit_api_key_value = access_secret(client, ApiKeys.LIVEKIT_API_KEY)
    livekit_api_secret_value = access_secret(client, ApiKeys.LIVEKIT_API_SECRET)
    livekit_url_value = access_secret(client, ApiKeys.LIVEKIT_WEBSOCKET_URL)

    room_name = authorization.room
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
        "matchId": authorization.match_id,
        "waliId": authorization.wali_id,
    }
