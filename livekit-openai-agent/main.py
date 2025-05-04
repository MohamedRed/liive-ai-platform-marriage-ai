from __future__ import annotations

import logging
from typing import Literal
from datetime import datetime, timedelta

from dotenv import load_dotenv
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    WorkerType,
    cli,
    llm,
    Agent,
    AgentSession,
    RunContext,
    function_tool,
    AgentStateChangedEvent,
    UserStateChangedEvent,
    UserInputTranscribedEvent,
    ConversationItemAddedEvent,
)
from livekit.plugins import silero, google
from enum import Enum
import firebase_admin
from firebase_admin import credentials, firestore, storage
import base64
import os
import json
import time
import fitz  # PyMuPDF for better PDF parsing
import asyncio
import tempfile
# import random   # <== REMOVED RANDOM ==>

from typing import Union, List
from dataclasses import dataclass
import aiofiles
from livekit.agents.utils import EventEmitter # Make sure EventEmitter is imported directly
from livekit import rtc # Import rtc for Room type hint
from livekit.agents.llm import ChatMessage, ChatContext, ChatRole
from livekit.agents.voice import FunctionToolsExecutedEvent

# Database collection names
COLLECTIONS = {
    'USERS': 'USERS',
    'USER_INFO': 'USER_INFO',
    'USER_SETTINGS': 'USER_SETTINGS',
    'QUESTIONS_ANSWERS': 'QAS',
    'QA_EDIT_LOGS': 'QA_EDIT_LOGS',
    'IDENTITY_VERIFICATIONS': 'ID_VERIFICATIONS',
    'USER_WALI_RELATION_VERIFICATIONS': 'USER_WALI_RELATION_VERIFICATIONS',
    'WALI_USER_PROVIDED_INFO': 'WALI_USER_PROVIDED_INFO',
    'WALI_INFO': 'WALI_INFO',
    'MATCHES': 'MATCHES',
    'AUDIT_LOGS': 'AUDIT_LOGS'
}

@dataclass
class EventLog:
    eventname: str | None
    """name of recorded event"""
    time: str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    """time the event is recorded"""

@dataclass
class TranscriptionLog:
    role: str | None
    """role of the speaker"""
    transcription: str | None
    """transcription of speech"""
    time: str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    """time the event is recorded"""

class ConversationPersistor(EventEmitter):
    # Define event types using Literal strings based on documentation
    AgentState = Literal['initializing', 'idle', 'listening', 'thinking', 'speaking']
    UserState = Literal['speaking', 'listening', 'away']

    def __init__(
        self,
        *,
        session: AgentSession | None,
        user_id: str,
        transcriptions_only: bool = False,
    ):
        """
        Initializes a ConversationPersistor instance which records the events and transcriptions of an AgentSession.

        Args:
            session (AgentSession): an instance of an AgentSession
            user_id (str): the ID of the user associated with the conversation
            transcriptions_only (bool): a boolean variable to determine if only transcriptions will be recorded, False by default
            log_path (str): the path to the log file in Cloud Storage
            user_transcriptions (arr): list of user transcriptions
            agent_transcriptions (arr): list of agent transcriptions
            events (arr): list of all events
            log_q (asyncio.Queue): a queue of EventLog and TranscriptionLog

        """
        super().__init__()

        self._session = session
        self._user_id = user_id
        self._transcriptions_only = transcriptions_only
        self._log_path = f"chat_logs/{user_id}/chat_log.txt"

        self._user_transcriptions = []
        self._agent_transcriptions = []
        self._events = []
        self._log_q = asyncio.Queue[Union[EventLog, TranscriptionLog, None]]()
        self._last_agent_state = None # To track agent stop speaking

        # ==> Initialize state variables directly to valid starting states <==
        self._agent_state: ConversationPersistor.AgentState = "initializing"
        self._user_state: ConversationPersistor.UserState = "listening" # Default UserState

    @property
    def log(self) -> str | None:
        return self._log_path

    @property
    def session(self) -> AgentSession | None:
        return self._session

    @property
    def user_transcriptions(self) -> dict:
        return self._user_transcriptions

    @property
    def agent_transcriptions(self) -> dict:
        return self._agent_transcriptions

    @property
    def events(self) -> dict:
        return self._events

    @log.setter
    def log(self, newlog: str | None) -> None:
        self._log_path = newlog

    async def _load_existing_logs(self):
        """Load existing logs from Cloud Storage"""
        try:
            bucket = storage.bucket()
            blob = bucket.blob(self._log_path)
            
            if blob.exists():
                existing_content = blob.download_as_text()
                # Create local file with existing content
                async with aiofiles.open("chat_log.txt", "w") as file:
                    await file.write(existing_content)
                logger.info(f"Loaded existing chat logs for user {self._user_id}")
            else:
                logger.info(f"No existing chat logs found for user {self._user_id}")
                
        except Exception as e:
            logger.error(f"Error loading existing chat logs: {e}")

    async def _save_to_cloud(self):
        """Save logs to Cloud Storage"""
        try:
            # Check if we have any content to save
            if not self._events and not self._user_transcriptions and not self._agent_transcriptions:
                logger.info(f"No logs to save for user {self._user_id}")
                return

            bucket = storage.bucket()
            blob = bucket.blob(self._log_path)
            
            # Read local file content
            async with aiofiles.open("chat_log.txt", "r") as file:
                content = await file.read()
            
            if not content.strip():  # Check if file is empty
                logger.info(f"No content to save for user {self._user_id}")
                return
                
            # Upload to Cloud Storage
            blob.upload_from_string(content)
            logger.info(f"Saved chat logs to cloud for user {self._user_id}")
            
        except Exception as e:
            logger.error(f"Error saving chat logs to cloud: {e}")

    async def _main_atask(self) -> None:
        await self._load_existing_logs()
        
        while True:
            log = await self._log_q.get()

            if log is None:
                await self._save_to_cloud()
                break

            async with aiofiles.open("chat_log.txt", "a") as file:
                if type(log) is EventLog and not self._transcriptions_only:
                    self._events.append(log)
                    await file.write("\n" + log.time + " " + log.eventname)

                if type(log) is TranscriptionLog:
                    if log.role == "user":
                        self._user_transcriptions.append(log)
                    else:
                        self._agent_transcriptions.append(log)

                    await file.write(
                        "\n" + log.time + " " + log.role + " " + log.transcription
                    )

    async def aclose(self) -> None:
        # Exits
        self._log_q.put_nowait(None)
        await self._main_task

    def start(self) -> None:
        if not self._session:
            logger.warning("ConversationPersistor started without a session.")
            return

        # Listens for emitted AgentSession events
        self._main_task = asyncio.create_task(self._main_atask())

        @self._session.on("user_state_changed")
        def on_user_state_changed(event: UserStateChangedEvent):
            event_name = None
            # Compare with string literal directly
            if event.new_state == 'speaking':
                event_name = "user_started_speaking"
            # Compare with string literal directly
            elif event.new_state == 'listening': # LISTENING means stopped
                event_name = "user_stopped_speaking"
            
            if event_name:
                log_entry = EventLog(eventname=event_name)
                self._log_q.put_nowait(log_entry)

        @self._session.on("agent_state_changed")
        def on_agent_state_changed(event: AgentStateChangedEvent):
            event_name = None
            # Compare with string literal directly
            if event.new_state == 'speaking':
                event_name = "agent_started_speaking"
            # Log stopped speaking when transitioning *from* SPEAKING to something else
            # Compare with string literal directly
            elif self._last_agent_state == 'speaking' and event.new_state != 'speaking':
                 event_name = "agent_stopped_speaking"
            
            self._last_agent_state = event.new_state # Update last state
            
            if event_name:
                log_entry = EventLog(eventname=event_name)
                self._log_q.put_nowait(log_entry)

        @self._session.on("user_input_transcribed")
        def on_user_input_transcribed(event: UserInputTranscribedEvent):
            if event.final: # Log only final transcription
                transcription = TranscriptionLog(
                    role="user",
                    transcription=event.transcript
                )
                self._log_q.put_nowait(transcription)
                # Also log the commit event itself
                commit_event = EventLog(eventname="user_speech_committed") 
                self._log_q.put_nowait(commit_event)

        @self._session.on("conversation_item_added")
        def on_conversation_item_added(event: ConversationItemAddedEvent):
            item = event.item
            if item.role == 'assistant':
                # Log agent transcription
                if item.text_content:
                     transcription = TranscriptionLog(
                         role="agent",
                         transcription=item.text_content,
                     )
                     self._log_q.put_nowait(transcription)
                     # Log commit event
                     commit_event = EventLog(eventname="agent_speech_committed")
                     self._log_q.put_nowait(commit_event)
                
                # Check for interruption
                if item.interrupted:
                    interrupt_event = EventLog(eventname="agent_speech_interrupted")
                    self._log_q.put_nowait(interrupt_event)
            elif item.role == 'user':
                 # Log user transcription (might be redundant with user_input_transcribed, but safe)
                 if item.text_content:
                    transcription = TranscriptionLog(
                        role="user",
                        transcription=item.text_content
                    )
                    self._log_q.put_nowait(transcription)

        @self._session.on("function_tools_executed")
        def on_function_tools_executed(event: FunctionToolsExecutedEvent):
            # This event fires after execution is complete.
            # Log both collected and finished to match old behavior.
            collected_event = EventLog(eventname="function_calls_collected")
            self._log_q.put_nowait(collected_event)
            finished_event = EventLog(eventname="function_calls_finished")
            self._log_q.put_nowait(finished_event)

    # ==> RESTORED get_chat_context method <==
    async def get_chat_context(self) -> ChatContext:
        """Convert conversation logs back into ChatContext (v1.0 Structure Attempt)"""
        logger.info(f"Attempting to load chat context from: {self._log_path}")
        history = ChatContext()
        try:
            bucket = storage.bucket()
            blob = bucket.blob(self._log_path)
            
            if not blob.exists():
                logger.warning(f"No existing chat log file found for context loading at {self._log_path}")
                return history # Return empty history

            content = blob.download_as_text()
            lines = content.strip().split('\n')
            logger.info(f"Loaded {len(lines)} lines from chat log.")
            
            # Parse the log file line-by-line (this is brittle)
            # Note: This simple parsing assumes logs strictly follow the format written 
            # by _main_atask and doesn't capture complex items like FunctionCall results accurately.
            # A more robust solution might store context directly or use structured logging (JSON).
            for line in lines:
                if not line:
                    continue
                
                parts = line.split(' ', 2)  # Split into [timestamp, type/role, content]
                if len(parts) < 2:
                    continue # Malformed line
                
                timestamp_str, type_or_role = parts[0], parts[1]
                content = parts[2] if len(parts) == 3 else ""

                # Check if it's a simple transcription log
                if type_or_role == "user":
                    history.messages.append(ChatMessage(role=ChatRole.USER, content=content))
                elif type_or_role == "agent":
                    history.messages.append(ChatMessage(role=ChatRole.ASSISTANT, content=content))
                # We are currently NOT parsing back logged Events (like speaking start/stop, function calls) 
                # into structured ChatContext items (like FunctionCall/FunctionCallOutput) 
                # because the simple log format doesn't store enough info.
                # Only user/agent text messages are reconstructed.

            logger.info(f"Reconstructed chat context with {len(history.messages)} messages.")
            return history
            
        except Exception as e:
            logger.error(f"Error loading chat context from logs: {e}")
            return history # Return potentially partial history

    def _update_agent_state(self, state: AgentState) -> None:
        # Now old_state should always be a valid AgentState literal
        old_state = self._agent_state
        if old_state == state: # Avoid emitting event if state hasn't changed
            return
        self._agent_state = state
        self.emit(
            "agent_state_changed", AgentStateChangedEvent(old_state=old_state, new_state=state)
        )

    def _update_user_state(self, state: UserState) -> None:
        # Now old_state should always be a valid UserState literal
        old_state = self._user_state
        # if self._user_state == state: # Original check was incorrect
        #     return
        if old_state == state: # Avoid emitting event if state hasn't changed
            return
        self._user_state = state
        self.emit("user_state_changed", UserStateChangedEvent(old_state=old_state, new_state=state))

    def _conversation_item_added(self, message: llm.ChatMessage) -> None:
        # ... existing code ...
        pass # Added pass to fix indentation

load_dotenv()

logger = logging.getLogger("my-worker")
logger.setLevel(logging.INFO)

class ApiKeys(Enum):
    OPENAI_API_KEY = 1
    CLOUD_FUNCTIONS_ENDPOINT = 2

paths = {
    ApiKeys.OPENAI_API_KEY: "projects/206700838957/secrets/OPENAI_API_KEY/versions/latest",
    ApiKeys.CLOUD_FUNCTIONS_ENDPOINT: "projects/206700838957/secrets/CLOUD_FUNCTIONS_ENDPOINT/versions/latest",
}

class SessionManager:
    # Add dependencies needed to re-create AgentSession
    def __init__(self, vad_plugin, agent_instance: Agent, room: rtc.Room, persistor: ConversationPersistor):
        logger.info("Initializing SessionManager")
        self.start_time = datetime.now()
        self.max_duration = timedelta(minutes=28)
        self.current_session: AgentSession | None = None
        # Store dependencies
        self.vad_plugin = vad_plugin
        self.agent_instance = agent_instance
        self.room = room
        self.persistor = persistor # Store persistor to load context
        self._lock = asyncio.Lock()

    def set_current_session(self, session: AgentSession):
        logger.info("Setting new current session")
        self.current_session = session
        self.start_time = datetime.now()

    def needs_rotation(self):
        if not self.current_session:
            return False
        elapsed = datetime.now() - self.start_time
        needs_rotate = elapsed >= self.max_duration
        # logger.info(f"Session duration: {elapsed.total_seconds()}s, needs rotation: {needs_rotate}") # Reduce log noise
        return needs_rotate

    # Updated rotate_session for AgentSession
    async def rotate_session(self) -> AgentSession | None:
        async with self._lock:
            if not self.current_session:
                logger.error("Rotation called but no current session exists.")
                return None
            
            logger.info("Starting session rotation")
            old_session = self.current_session
            
            # 1. Get chat context by reading from persistor logs
            chat_ctx = await self.persistor.get_chat_context()
            logger.info(f"Loaded chat context from logs with {len(chat_ctx.messages)} messages.")

            # 2. Close the old session
            try:
                await old_session.aclose()
                logger.info("Closed old session")
            except Exception as e:
                logger.error(f"Error closing old session: {e}")
            
            # 3. Create a new AgentSession
            logger.info("Creating new session")
            new_agent_session = AgentSession(
                vad=self.vad_plugin,
            )
            logger.info("Created new AgentSession instance")

            # 4. Try setting context AFTER initialization (Hypothetical)
            if chat_ctx and chat_ctx.messages:
                 logger.info("Attempting to set loaded chat context on new session (method hypothetical)")
                 try:
                    # Option A: Update context directly (check if method exists)
                    await new_agent_session.update_chat_context(chat_ctx.messages)
                    logger.info("Successfully set chat context using update_chat_context")
                 except AttributeError:
                    try:
                       # Option B: Maybe internal context object is accessible? (Less likely)
                       # new_agent_session._chat_context = chat_ctx 
                       # logger.info("Successfully set chat context via internal attribute (use with caution)")
                       logger.warning("update_chat_context not found. Unable to set context on new session.")
                    except Exception as e_set:
                       logger.error(f"Failed to set chat context on new session: {e_set}")
                 except Exception as e_update:
                     logger.error(f"Error calling update_chat_context: {e_update}")

            # 5. Start the new session
            try:
                await new_agent_session.start(agent=self.agent_instance, room=self.room)
                logger.info("Started new session successfully")
            except Exception as e:
                 logger.error(f"Error starting new session: {e}")
                 # Decide how to handle failure: return None? Retry?
                 return None

            # 6. Update the manager
            self.set_current_session(new_agent_session)
            logger.info("Session rotation complete")
            
            return new_agent_session

# Constants for Gemini Config
GEMINI_MODEL_NAME = "gemini-2.0-flash-exp"
# GEMINI_VOICE_NAME = "Puck"             # REMOVED Constant

# ==> List of valid voices <==
VALID_GEMINI_VOICES = ["Puck", "Charon", "Kore", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"]
# _voice_index = -1 # REMOVED global index

# Get Location from environment, default to us-central1 if not set
# GCP_PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT") # REMOVED
GCP_LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1") # Keep default

async def entrypoint(ctx: JobContext):
    # global _voice_index # REMOVED

    logger.info("ENTRYPOINT: Starting")

    # --- Firebase Initialization, Get Project ID & Set GOOGLE_APPLICATION_CREDENTIALS ---
    gcp_project_id_from_creds = None # Initialize
    tmp_cred_file_path = None # To store temp file path for potential cleanup
    try:
        logger.info("ENTRYPOINT: Initializing Firebase Admin, extracting Project ID, and setting ADC env var...") # Updated log
        firebase_admin_sdk_key = os.environ.get("FIREBASE_ADMIN_SDK_KEY")
        if firebase_admin_sdk_key is None:
            logger.error("CRITICAL: FIREBASE_ADMIN_SDK_KEY missing from environment")
            raise ValueError("FIREBASE_ADMIN_SDK_KEY missing")
        base64_bytes = base64.b64decode(firebase_admin_sdk_key).decode("ascii")
        cred_json = json.loads(base64_bytes) # Parsed JSON

        # ==> Extract Project ID from JSON <==
        gcp_project_id_from_creds = cred_json.get("project_id")
        if not gcp_project_id_from_creds:
             logger.error("CRITICAL: 'project_id' not found within Firebase credentials JSON.")
             raise ValueError("'project_id' not found in credentials JSON")

        logger.info(f"ENTRYPOINT: Extracted Project ID: {gcp_project_id_from_creds}")

        # ==> RESTORED: Write JSON to temp file for ADC <==
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        tmp.write(json.dumps(cred_json).encode())
        tmp_cred_file_path = tmp.name # Store path
        tmp.close()
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp_cred_file_path
        logger.info(f"ENTRYPOINT: Set GOOGLE_APPLICATION_CREDENTIALS to temp file: {tmp_cred_file_path}")

        # Initialize Firebase Admin using the parsed JSON dictionary
        cred = credentials.Certificate(cred_json)
        app = firebase_admin.initialize_app(cred, {'storageBucket': 'marriage-ai-289c6.firebasestorage.app'})
        db = firestore.client()
        bucket = storage.bucket()
        logger.info("ENTRYPOINT: Firebase Admin initialized successfully.")
    except Exception as e:
        logger.error(f"CRITICAL: Failed during Firebase Admin initialization/ADC setup: {e}", exc_info=True) # Updated log
        # ==> ADDED: Clean up temp file if created before failure <==
        if tmp_cred_file_path and os.path.exists(tmp_cred_file_path):
            try:
                os.remove(tmp_cred_file_path)
                logger.info(f"Cleaned up temporary credential file: {tmp_cred_file_path}")
            except OSError as os_err:
                logger.error(f"Error removing temporary credential file {tmp_cred_file_path}: {os_err}")
        return # Stop if setup fails

    # Connect early to get participant info
    participant = None
    try:
        logger.info("ENTRYPOINT: Connecting to LiveKit room...")
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        logger.info("ENTRYPOINT: Connected to LiveKit room. Waiting for participant...")
        # Add a timeout to wait_for_participant to prevent hanging indefinitely
        participant = await asyncio.wait_for(ctx.wait_for_participant(), timeout=30.0) 
        logger.info(f"ENTRYPOINT: Participant joined: {participant.identity if participant else 'None'}")
    except asyncio.TimeoutError:
        logger.error("CRITICAL: Timed out waiting for participant to join.")
        return # Stop if no participant
    except Exception as e:
        logger.error(f"CRITICAL: Failed during LiveKit connection or participant wait: {e}", exc_info=True)
        return # Stop on connection failure
        
    if not participant:
        logger.error("CRITICAL: Failed to get participant info after connect.")
        return # Stop if participant is somehow None

    # ==> REMOVED CHECK FOR GCP_PROJECT_ID ENV VAR, KEPT LOCATION CHECK <==
    # Remove project ID check
    # if not GCP_PROJECT_ID:
    #    logger.error("CRITICAL: GOOGLE_CLOUD_PROJECT environment variable is not set. This is required for Vertex AI.")
    #    return # Stop if env vars are missing
    if not GCP_LOCATION: # Keep location check (though it has a default)
        logger.error("CRITICAL: GCP_LOCATION is somehow empty even after default. Cannot proceed.")
        return

    # ==> Cycle through voices sequentially (within this worker process) <==
    # _voice_index = (_voice_index + 1) % len(VALID_GEMINI_VOICES)
    # selected_voice = VALID_GEMINI_VOICES[_voice_index]
    # logger.info(f"ENTRYPOINT: Sequentially selected voice for this session: {selected_voice} (Index: {_voice_index})")

    # Define the Agent class *inside* entrypoint or ensure it can access agent_instances
    class MarriageAICounselorAgent(Agent):
        def __init__(self, db_client, storage_bucket, room_ctx, agent_participant, 
                     instructions: str, llm_instance, agents_map_ref: dict, voice_name: str): # <== Added voice_name param
            super().__init__(instructions=instructions, llm=llm_instance) # Tools discovered automatically
            self.db = db_client
            self.storage_bucket = storage_bucket
            self.ctx = room_ctx
            self.participant = agent_participant
            self.agents_map = agents_map_ref # Store reference to the map
            self.current_voice = voice_name # Store passed voice_name instead of llm_instance.voice

        @function_tool
        async def get_user_profile(self, context: RunContext):
            """Retrieves the user's profile information including their previous questions and answers."""
            logger.info(f"Retrieving profile for user {self.participant.identity}")
            
            try:
                # Get user info
                user_info_ref = self.db.collection(COLLECTIONS['USER_INFO']).document(self.participant.identity)
                user_info = user_info_ref.get()
                
                if not user_info.exists:
                    logger.warning(f"No user info found for user {self.participant.identity}")
                    return "User profile not found. Please ensure your account is properly set up."
                
                # Get questions and answers
                qa_ref = self.db.collection(COLLECTIONS['QUESTIONS_ANSWERS']).document(self.participant.identity)
                qa_doc = qa_ref.get()
                
                if not qa_doc.exists:
                    logger.warning(f"No Q&A document found for user {self.participant.identity}")
                    return "No questions and answers found."
                    
                qa_data = qa_doc.to_dict() or {}  # Use empty dict as fallback
                logger.info(f"Retrieved Q&A data: {qa_data}")
                
                questions = qa_data.get('questions', {})
                logger.info(f"Questions map: {questions}")
                
                if not questions:
                    logger.warning(f"Questions map is empty for user {self.participant.identity}")
                    return "No questions found in the profile."
                
                # Format Q&A into a readable string
                formatted_qa = []
                for qa_id, qa in questions.items():
                    try:
                        # Handle potential None values and missing fields more gracefully
                        question = qa.get('question', 'N/A')
                        answer = qa.get('answer', 'No answer provided')
                        section = qa.get('section', 'No section')
                        updated_at = qa.get('updatedAt')
                        created_at = qa.get('createdAt')
                        
                        # Format timestamp if it exists
                        timestamp = updated_at or created_at
                        timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S') if timestamp else 'No date'
                        
                        formatted_qa.append(
                            f"Question ID: {qa_id}\n"
                            f"Question: {question}\n"
                            f"Answer: {answer}\n"
                            f"Section: {section}\n"
                            f"Last Updated: {timestamp_str}"
                        )
                    except (KeyError, AttributeError) as e:
                        logger.warning(f"Skipping malformed Q&A entry {qa_id}: {e}")
                        continue
                
                if not formatted_qa:
                    logger.warning(f"No valid Q&A entries found for user {self.participant.identity}")
                    return "No valid Q&A entries found"
                
                logger.info(f"Successfully formatted {len(formatted_qa)} Q&A entries")
                return "\n\n".join(formatted_qa)
                
            except Exception as e:
                logger.error(f"Error retrieving profile: {str(e)}")
                return "Error retrieving profile information. Please try again later."

        @function_tool
        async def verify_identity(self, context: RunContext):
            """Called when needed to verify the identity of a user. This function will return a boolean indicating whether the verification was successful or not."""
            logger.info(f"verifying identity of user {self.participant.identity}")

            try:
              response = await self.ctx.room.local_participant.perform_rpc(
                destination_identity=self.participant.identity,
                method='verify_identity',
                payload='',
                response_timeout=5000.0
              )
              print(f"verification identity RPC response: {response}")
              return response
            except Exception as e:
              print(f"verification identity RPC call failed for {self.participant.identity}: {e}")
              return "Unable to verify user's identity"

        @function_tool
        async def update_question(
            self,
            context: RunContext,
            section: str,
            question: str,
        ):
            """Called when the AI wants to ask a new question. This will create or update the question in Firestore before getting the answer.
            
            IMPORTANT: The AI must call this function before asking a question to the user. This ensures that:
            1. The question is properly stored in the database
            2. The question is visible in the user's profile
            3. The question is properly categorized by section
            4. The UI can show the question to the user
            
            The function will:
            1. Create a new question entry if it doesn't exist
            2. Update the section if the question already exists
            3. Show the profile modal with the question highlighted
            4. Initialize an empty answer field for the user to fill in
            
            The AI should call this function before asking any question to ensure proper tracking and display.
            """
            logger.info(f"updating question for user {self.participant.identity}")

            try:
                qa_ref = self.db.collection(COLLECTIONS['QUESTIONS_ANSWERS']).document(self.participant.identity)
                qa_doc = qa_ref.get()
                qa_data = qa_doc.to_dict() or {}
                
                # Initialize questions map if it doesn't exist
                questions = qa_data.get('questions', {})
                
                # Check if question already exists
                existing_key = None
                for key, qa in questions.items():
                    if qa.get('question') == question:
                        existing_key = key
                        break
                
                if not questions:
                    # First Q&A entry
                    qa_key = f"qa_{int(time.time())}"
                    qa_ref.set({
                        'questions': {
                            qa_key: {
                                "section": section,
                                "question": question,
                                "answer": "",
                                "createdAt": firestore.SERVER_TIMESTAMP
                            }
                        }
                    }, merge=True)
                    print(f"Created first question: {question}")
                elif existing_key:
                    # Update existing Q&A section
                    qa_ref.update({
                        f'questions.{existing_key}.section': section,
                        f'questions.{existing_key}.updatedAt': firestore.SERVER_TIMESTAMP
                    })
                    print(f"Updated existing question section: {question}")
                else:
                    # Add new Q&A
                    qa_key = f"qa_{int(time.time())}"
                    qa_ref.update({
                        f'questions.{qa_key}': {
                            "section": section,
                            "question": question,
                            "answer": "",
                            "createdAt": firestore.SERVER_TIMESTAMP
                        }
                    })
                    print(f"Added new question: {question}")
                
                # Show the profile modal and highlight the question
                await self.show_profile_question(context, section, existing_key or qa_key)
                
                return "Question updated successfully"
                
            except Exception as e:
                print(f"update of question failed for {self.participant.identity}: {e}")
                return "Unable to update question"

        @function_tool
        async def update_answer(
            self,
            context: RunContext,
            question: str,
            answer: str,
        ):
            """Called when the AI receives an answer from the user. This will update the answer in Firestore.
            
            IMPORTANT: The AI must call this function after receiving a user's answer to save it to the database.
            This is the AI's responsibility as it may need to:
            1. Process the answer first
            2. Ask follow-up questions
            3. Validate the answer
            4. Combine multiple parts of the answer
            
            The AI should call this function when it is satisfied with the user's answer and wants to save it.
            """
            logger.info(f"updating answer for user {self.participant.identity}")

            try:
                qa_ref = self.db.collection(COLLECTIONS['QUESTIONS_ANSWERS']).document(self.participant.identity)
                qa_doc = qa_ref.get()
                qa_data = qa_doc.to_dict() or {}
                
                # Find the question ID
                questions = qa_data.get('questions', {})
                question_id = None
                for key, qa in questions.items():
                    if qa.get('question') == question:
                        question_id = key
                        break
                
                if not question_id:
                    return "Question not found"
                
                # Update the answer
                qa_ref.update({
                    f'questions.{question_id}.answer': answer,
                    f'questions.{question_id}.updatedAt': firestore.SERVER_TIMESTAMP
                })
                
                # Create QA edit log
                edit_log_ref = self.db.collection(COLLECTIONS['QA_EDIT_LOGS']).document()
                edit_log_ref.set({
                    'userId': self.participant.identity,
                    'questionId': question_id,
                    'previousAnswer': questions.get(question_id, {}).get('answer', ''),
                    'newAnswer': answer,
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'metadata': {
                        'deviceInfo': 'AI Agent',
                        'location': {
                            'country': 'US'  # Default to US for now
                        }
                    }
                })
                
                # Show the profile modal and highlight the updated answer
                section = questions.get(question_id, {}).get('section', '')
                await self.show_profile_question(context, section, question_id)
                
                print(f"update of answer successful")
                return "Update of answer successful"
                
            except Exception as e:
                print(f"update of answer failed for {self.participant.identity}: {e}")
                return "Unable to update answer"

        @function_tool
        async def show_profile_modal(self, context: RunContext):
            """Opens the user profile modal."""
            try:
                response = await self.ctx.room.local_participant.perform_rpc(
                    destination_identity=self.participant.identity,
                    method='show_profile_modal',
                    payload='',
                    response_timeout=5000.0
                )
                return "Successfully opened profile modal"
            except Exception as e:
                logger.error(f"Failed to open profile modal: {e}")
                return "Failed to open profile modal"

        @function_tool
        async def show_profile_question(
            self,
            context: RunContext,
            section: str,
            question_id: str,
        ):
            """Shows the user profile modal and scrolls to a specific question."""
            try:
                # First open the profile modal
                await self.show_profile_modal(context)
                
                # Then scroll to the specific question
                response = await self.ctx.room.local_participant.perform_rpc(
                    destination_identity=self.participant.identity,
                    method='show_profile_question',
                    payload=json.dumps({
                        'section': section,
                        'questionId': question_id
                    }),
                    response_timeout=5000.0
                )
                return "Successfully opened profile and highlighted question"
            except Exception as e:
                logger.error(f"Failed to show profile: {e}")
                return "Failed to open profile"

        @function_tool
        async def show_matches(self, context: RunContext):
            """Shows the matches modal to the user."""
            try:
                response = await self.ctx.room.local_participant.perform_rpc(
                    destination_identity=self.participant.identity,
                    method='show_matches',
                    payload='',
                    response_timeout=5000.0
                )
                return "Successfully opened matches"
            except Exception as e:
                logger.error(f"Failed to show matches: {e}")
                return "Failed to open matches"

        @function_tool
        async def manage_wali(
            self,
            context: RunContext,
            action: str,
        ):
            """Opens the Wali management modal.

            Args:
                action (str): The action to perform: 'create' or 'update'.
            """
            try:
                response = await self.ctx.room.local_participant.perform_rpc(
                    destination_identity=self.participant.identity,
                    method='manage_wali',
                    payload=json.dumps({'action': action}),
                    response_timeout=5000.0
                )
                return "Successfully opened Wali management"
            except Exception as e:
                logger.error(f"Failed to manage Wali: {e}")
                return "Failed to open Wali management"

        @function_tool
        async def change_voice(self, context: RunContext, new_voice_name: str):
            """Changes the agent's voice to the specified name. Valid names are: Puck, Charon, Kore, Fenrir, Aoede, Leda, Orus, Zephyr."""
            logger.info(f"TOOL: Received request to change voice to: {new_voice_name}")
            if new_voice_name in self.agents_map:
                target_agent = self.agents_map[new_voice_name]
                logger.info(f"TOOL: Found target agent for voice {new_voice_name}. Initiating handoff.")
                # Return tuple: (target_agent_instance, optional_message_to_speak)
                return target_agent, f"Okay, switching my voice to {new_voice_name}."
            else:
                logger.warning(f"TOOL: Invalid voice name requested: {new_voice_name}")
                valid_voices_str = ", ".join(self.agents_map.keys())
                return f"Sorry, I can't switch to that voice. Valid voices are: {valid_voices_str}."

    # Remove the old AssistantFnc class definition
    # class AssistantFnc(llm.FunctionContext):
    #    ... (all methods moved to MarriageAICounselorAgent)

    # Remove the old fnc_ctx instantiation
    # fnc_ctx = AssistantFnc()

    def read_pdf_from_firebase(file_path):
        """
        Reads a PDF file from Firebase Storage and converts it to a string,
        preserving structural elements like lists, paragraphs, and formatting.

        :param file_path: The path to the PDF file in Firebase Storage.
        :return: The extracted text from the PDF as a well-formatted string.
        """
        try:
            # Use the bucket reference from the outer scope
            blob = bucket.blob(file_path)
            
            if not blob.exists():
                raise FileNotFoundError(f"File {file_path} does not exist in the bucket.")
                
            # Download the PDF content as bytes
            pdf_content = blob.download_as_bytes()
            
            # Use PyMuPDF (fitz) for better text extraction with preserved formatting
            doc = fitz.open(stream=pdf_content, filetype="pdf")
            
            all_text = ""
            
            for page in doc:
                # Extract text with better preservation of structure
                text = page.get_text("text")  # Simple text mode preserves more formatting than PyPDF2
                all_text += text + "\n\n"  # Double newline between pages for better separation
                
            # Additional post-processing to improve formatting
            all_text = all_text.replace("\n\n\n", "\n\n")  # Remove excessive newlines
            
            # Enhance formatting of lists and bullet points
            lines = all_text.split("\n")
            for i in range(len(lines)):
                # Add extra space before bullet points and numbered lists for better parsing
                if (lines[i].strip().startswith(("•", "-", "*")) or 
                    (lines[i].strip() and lines[i][0].isdigit() and "." in lines[i][:5])):
                    lines[i] = "\n" + lines[i]
            
            all_text = "\n".join(lines)
            
            # Clean up any artifacts
            all_text = all_text.replace("\n\n\n\n", "\n\n")
            
            # ==> ADDED FINAL LOG <==
            logger.info(f"PDF_LOADER: Successfully processed PDF '{file_path}'. Returning text.")
            return all_text
            
        except Exception as e:
            # ==> ADDED ERROR LOG <==
            logger.error(f"PDF_LOADER: Error processing PDF {file_path}: {e}", exc_info=True)
            return None # Return None on error

    # ==> ADDED LOGGING AROUND PDF CALL <==
    logger.info("ENTRYPOINT: Attempting to load agent instructions from PDF...")
    marriage_counselor_instructions = read_pdf_from_firebase("agent-instructions-1.0.pdf")
    if marriage_counselor_instructions:
        logger.info("ENTRYPOINT: Successfully loaded agent instructions from PDF.")
    else:
        logger.error("CRITICAL: Failed to load agent instructions from PDF. Cannot start agent.")
        return # Stop if instructions failed to load
    
    full_instructions = marriage_counselor_instructions # Simplified

    # ==> Create instances for all voices <==
    llm_instances: dict[str, google.beta.realtime.RealtimeModel] = {}
    agent_instances: dict[str, 'MarriageAICounselorAgent'] = {}
    
    logger.info(f"ENTRYPOINT: Initializing RealtimeModel instances for voices: {VALID_GEMINI_VOICES}")
    for voice in VALID_GEMINI_VOICES:
        realtime_llm = None
        try:
            logger.info(f"Attempting to initialize Google RealtimeModel via Vertex AI for voice: {voice}...")
            realtime_llm = google.beta.realtime.RealtimeModel(
                model=GEMINI_MODEL_NAME,
                voice=voice,
                temperature=0.8,
                vertexai=True,
                project=gcp_project_id_from_creds, 
                location=GCP_LOCATION
            )
            llm_instances[voice] = realtime_llm
            logger.info(f"Successfully initialized RealtimeModel for voice: {voice}")
        except Exception as e:
            logger.error(f"Failed to initialize RealtimeModel for voice {voice}: {e}", exc_info=True)
            # Continue trying other voices

    if not llm_instances:
        logger.error("CRITICAL: Failed to initialize ANY RealtimeModel instances. Cannot start agent.")
        return

    # ==> Create Agent instances, passing the map and voice name <==
    logger.info("ENTRYPOINT: Initializing Agent instances...")
    for voice, llm_instance in llm_instances.items():
        agent_instances[voice] = MarriageAICounselorAgent(
            db_client=db,
            storage_bucket=bucket,
            room_ctx=ctx,
            agent_participant=participant,
            instructions=full_instructions,
            llm_instance=llm_instance,
            agents_map_ref=agent_instances, # Pass the dict reference
            voice_name=voice                 # <== Pass the voice name explicitly
        )
        logger.info(f"Initialized agent instance for voice: {voice}")

    # ==> Select default agent and start session <==
    DEFAULT_VOICE = "Puck"
    if DEFAULT_VOICE not in agent_instances:
        # Fallback if Puck failed
        if not agent_instances:
             logger.error("CRITICAL: No agent instances were successfully created.")
             return
        DEFAULT_VOICE = list(agent_instances.keys())[0] # Use first available
        logger.warning(f"Default voice 'Puck' not available, falling back to '{DEFAULT_VOICE}'")
        
    default_agent = agent_instances[DEFAULT_VOICE]
    logger.info(f"ENTRYPOINT: Starting session with default voice: {DEFAULT_VOICE}")

    # Initialize AgentSession (VAD only)
    vad_plugin = silero.VAD.load()
    session = AgentSession(vad=vad_plugin)

    # Initialize ConversationPersistor
    cp = ConversationPersistor(
        session=session,
        user_id=participant.identity,
        transcriptions_only=False
    )

    # Initialize session manager (remove stt_plugin arg if still present)
    session_manager = SessionManager(
        vad_plugin=vad_plugin,
        agent_instance=default_agent, # Needs the *current* agent for rotation
        room=ctx.room,
        persistor=cp
    )
    # Store initial agent in session_manager
    session_manager.set_current_session(session) 
    # We might need to update session_manager's agent_instance reference upon handoff? TODO: Review rotation logic

    # Start persistor task
    cp.start()

    # Start the AgentSession with the default agent
    try:
        logger.info("Starting AgentSession...")
        await session.start(agent=default_agent, room=ctx.room)
        logger.info("AgentSession started successfully.")
    except Exception as e:
        logger.error(f"Error starting AgentSession: {e}", exc_info=True)
        return

    # Generate initial reply (simplified)
    try:
        logger.info("Generating initial reply based on agent main instructions...")
        await session.generate_reply()
        logger.info("Initial reply generation requested.")
    except Exception as e_reply:
        logger.error(f"Error during initial reply generation: {e_reply}", exc_info=True)

    async def check_session_rotation():
        while True:
            try:
                await asyncio.sleep(60)
                # Use the session manager's stored session
                if session_manager.needs_rotation():
                    logger.info("Starting session rotation due to duration limit")
                    # Dependencies are now stored in session_manager
                    new_session = await session_manager.rotate_session()
                    if new_session:
                        logger.info("Session rotation appears successful.")
                        # No explicit response creation needed? Start should handle it.
                    else:
                        logger.error("Session rotation failed.")
                        # Consider error handling/retry strategy here
                        await asyncio.sleep(30) # Wait before trying again after failure

            except asyncio.CancelledError:
                logger.info("Session rotation task cancelled.")
                break
            except Exception as e:
                logger.error(f"Error during session rotation check: {e}")
                await asyncio.sleep(5) # Wait before retrying check loop

    rotation_task = asyncio.create_task(check_session_rotation())

    # -- Cleanup Function -- 
    # Ensure it cleans up the temp file
    async def cleanup():
        logger.info("Starting cleanup")
        try:
            if not rotation_task.done():
                rotation_task.cancel()
                try:
                    await rotation_task # Wait for cancellation to complete
                except asyncio.CancelledError:
                    logger.info("Session rotation task successfully cancelled.")
            # Close the *current* session held by the manager
            if session_manager.current_session:
                await session_manager.current_session.aclose()
                logger.info("Closed current AgentSession from manager")
            # If rotation failed or never happened, the original session might still be the one to close
            # elif session and not session._closed: # Check if initial session exists and isn't closed
            #    await session.aclose() 
            #    logger.info("Closed initial AgentSession (manager had no current session or it was same)")
            
            # Close the persistor (which saves logs on close)
            await cp.aclose()
            logger.info("Closed conversation persistor")

            # ==> ADDED/ENSURED: Temp file cleanup <==
            logger.info("CLEANUP: Checking for temporary credential file...")
            if tmp_cred_file_path and os.path.exists(tmp_cred_file_path):
                try:
                    os.remove(tmp_cred_file_path)
                    logger.info(f"CLEANUP: Successfully removed temporary credential file: {tmp_cred_file_path}")
                except OSError as e:
                    logger.error(f"CLEANUP: Error removing temporary credential file {tmp_cred_file_path}: {e}")
            else:
                 logger.info(f"CLEANUP: Temporary credential file not found or path not set: {tmp_cred_file_path}")

        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    ctx.add_shutdown_callback(cleanup) # Ensure callback is added

if __name__ == "__main__":
    # TODO: Check if WorkerOptions needs changes for Agent 1.0
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, worker_type=WorkerType.ROOM))

