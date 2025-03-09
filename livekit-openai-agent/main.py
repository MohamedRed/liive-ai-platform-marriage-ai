from __future__ import annotations

import logging
from typing import Annotated
from datetime import datetime, timedelta

from dotenv import load_dotenv
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    WorkerType,
    cli,
    llm,
    multimodal,
    utils
)
from livekit.plugins import openai
from enum import Enum
import firebase_admin
from firebase_admin import credentials, firestore, storage
import base64
import os
import json
import time
import io
import fitz  # PyMuPDF for better PDF parsing
import asyncio

from typing import Union
from livekit.agents.multimodal.multimodal_agent import EventTypes
from dataclasses import dataclass
import aiofiles

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

class ConversationPersistor(utils.EventEmitter[EventTypes]):
    def __init__(
        self,
        *,
        model: multimodal.MultimodalAgent | None,
        user_id: str,
        transcriptions_only: bool = False,
    ):
        """
        Initializes a ConversationPersistor instance which records the events and transcriptions of a MultimodalAgent.

        Args:
            model (multimodal.MultimodalAgent): an instance of a MultiModalAgent
            user_id (str): the ID of the user associated with the conversation
            transcriptions_only (bool): a boolean variable to determine if only transcriptions will be recorded, False by default
            log_path (str): the path to the log file in Cloud Storage
            user_transcriptions (arr): list of user transcriptions
            agent_transcriptions (arr): list of agent transcriptions
            events (arr): list of all events
            log_q (asyncio.Queue): a queue of EventLog and TranscriptionLog

        """
        super().__init__()

        self._model = model
        self._user_id = user_id
        self._transcriptions_only = transcriptions_only
        self._log_path = f"chat_logs/{user_id}/chat_log.txt"

        self._user_transcriptions = []
        self._agent_transcriptions = []
        self._events = []
        self._log_q = asyncio.Queue[Union[EventLog, TranscriptionLog, None]]()

    @property
    def log(self) -> str | None:
        return self._log_path

    @property
    def model(self) -> multimodal.MultimodalAgent | None:
        return self._model

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
        # Listens for emitted MultimodalAgent events
        self._main_task = asyncio.create_task(self._main_atask())

        @self._model.on("user_started_speaking")
        def _user_started_speaking():
            event = EventLog(eventname="user_started_speaking")
            self._log_q.put_nowait(event)

        @self._model.on("user_stopped_speaking")
        def _user_stopped_speaking():
            event = EventLog(eventname="user_stopped_speaking")
            self._log_q.put_nowait(event)

        @self._model.on("agent_started_speaking")
        def _agent_started_speaking():
            event = EventLog(eventname="agent_started_speaking")
            self._log_q.put_nowait(event)

        @self._model.on("agent_stopped_speaking")
        def _agent_stopped_speaking():
            event = EventLog(eventname="agent_stopped_speaking")
            self._log_q.put_nowait(event)

        @self._model.on("user_speech_committed")
        def _user_speech_committed(user_msg: str):
            transcription = TranscriptionLog(
                role="user", 
                transcription=user_msg
            )
            self._log_q.put_nowait(transcription)

            event = EventLog(eventname="user_speech_committed")
            self._log_q.put_nowait(event)

        @self._model.on("agent_speech_committed")
        def _agent_speech_committed(agent_msg: str):
            transcription = TranscriptionLog(
                role="agent",
                transcription=agent_msg,
            )
            self._log_q.put_nowait(transcription)   
            
            event = EventLog(eventname="agent_speech_committed")
            self._log_q.put_nowait(event)

        @self._model.on("agent_speech_interrupted")
        def _agent_speech_interrupted():
            event = EventLog(eventname="agent_speech_interrupted")
            self._log_q.put_nowait(event)

        @self._model.on("function_calls_collected")
        def _function_calls_collected():
            event = EventLog(eventname="function_calls_collected")
            self._log_q.put_nowait(event)

        @self._model.on("function_calls_finished")
        def _function_calls_finished():
            event = EventLog(eventname="function_calls_finished")
            self._log_q.put_nowait(event)

    async def get_chat_context(self) -> llm.ChatContext:
        """Convert conversation logs to ChatContext for the AI"""
        try:
            bucket = storage.bucket()
            blob = bucket.blob(self._log_path)
            
            if not blob.exists():
                logger.info(f"No existing chat logs found for user {self._user_id}")
                return llm.ChatContext()

            content = blob.download_as_text()
            messages = []
            
            # Parse the log file and convert to ChatMessages
            for line in content.strip().split('\n'):
                if not line:
                    continue
                    
                parts = line.split(' ', 2)  # Split into [timestamp, role, content]
                if len(parts) == 3:
                    timestamp, role, content = parts
                    if role in ['user', 'agent']:  # Only process actual messages
                        # Skip event lines
                        if content.startswith('started_speaking') or content.startswith('stopped_speaking') or content.startswith('speech_committed'):
                            continue
                            
                        # Clean up agent messages that start with partial words
                        if role == 'agent' and content.startswith(('a ', 'm ', 'ould ', "'m ")):
                            content = content[content.find(' ')+1:]
                            
                        messages.append(llm.ChatMessage(
                            role='assistant' if role == 'agent' else 'user',
                            content=content
                        ))

            return llm.ChatContext(messages=messages)
            
        except Exception as e:
            logger.error(f"Error loading chat context from logs: {e}")
            return llm.ChatContext()

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
    def __init__(self, initial_chat_ctx=None):
        logger.info("Initializing SessionManager")
        self.start_time = datetime.now()
        self.max_duration = timedelta(minutes=28)
        self.current_session = None

    def set_current_session(self, session):
        logger.info("Setting new current session")
        self.current_session = session
        self.start_time = datetime.now()

    def needs_rotation(self):
        elapsed = datetime.now() - self.start_time
        needs_rotate = elapsed >= self.max_duration
        logger.info(f"Session duration: {elapsed.total_seconds()}s, needs rotation: {needs_rotate}")
        return needs_rotate

    async def rotate_session(self, model, agent):
        logger.info("Starting session rotation")
        await self.current_session.aclose()
        logger.info("Closed old session")
        
        chat_ctx = agent.chat_ctx_copy()
        logger.info(f"Copied chat context with {len(chat_ctx.messages)} messages")
        
        logger.info("Creating new session")
        new_session = model.session(
            model=model.model,
            modalities=model.modalities,
            instructions=model.instructions,
            voice=model.voice,
            temperature=model.temperature,
            max_response_output_tokens=model.max_response_output_tokens,
            turn_detection=model.turn_detection,
            chat_ctx=chat_ctx,
        )
        logger.info("Created new session successfully")
        
        self.set_current_session(new_session)
        model.sessions[0] = new_session
        logger.info("Session rotation complete")
        
        return new_session

async def entrypoint(ctx: JobContext):
    logger.info("starting entrypoint")

    # Use a service account.
    firebase_admin_sdk_key = os.environ.get("FIREBASE_ADMIN_SDK_KEY")
    if firebase_admin_sdk_key is None:
      raise ValueError("FIREBASE_ADMIN_SDK_KEY missing")
    base64_bytes = base64.b64decode(firebase_admin_sdk_key).decode("ascii")
    cred_json = json.loads(base64_bytes)
    cred = credentials.Certificate(cred_json)
    app = firebase_admin.initialize_app(cred, {'storageBucket': 'marriage-ai-289c6.firebasestorage.app'})
    db = firestore.client()
    bucket = storage.bucket()

    class AssistantFnc(llm.FunctionContext):
        @llm.ai_callable()
        async def get_user_profile(self):
            """Retrieves the user's profile information including their previous questions and answers."""
            logger.info(f"Retrieving profile for user {participant.identity}")
            
            try:
                # Get user info
                user_info_ref = db.collection(COLLECTIONS['USER_INFO']).document(participant.identity)
                user_info = user_info_ref.get()
                
                if not user_info.exists:
                    logger.warning(f"No user info found for user {participant.identity}")
                    return "User profile not found. Please ensure your account is properly set up."
                
                # Get questions and answers
                qa_ref = db.collection(COLLECTIONS['QUESTIONS_ANSWERS']).document(participant.identity)
                qa_doc = qa_ref.get()
                
                if not qa_doc.exists:
                    logger.warning(f"No Q&A document found for user {participant.identity}")
                    return "No questions and answers found."
                    
                qa_data = qa_doc.to_dict() or {}  # Use empty dict as fallback
                logger.info(f"Retrieved Q&A data: {qa_data}")
                
                questions = qa_data.get('questions', {})
                logger.info(f"Questions map: {questions}")
                
                if not questions:
                    logger.warning(f"Questions map is empty for user {participant.identity}")
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
                    logger.warning(f"No valid Q&A entries found for user {participant.identity}")
                    return "No valid Q&A entries found"
                
                logger.info(f"Successfully formatted {len(formatted_qa)} Q&A entries")
                return "\n\n".join(formatted_qa)
                
            except Exception as e:
                logger.error(f"Error retrieving profile: {str(e)}")
                return "Error retrieving profile information. Please try again later."

        @llm.ai_callable()
        async def verify_identity(self):
            """Called when needed to verify the identity of a user. This function will return a boolean indicating whether the verification was successful or not."""
            logger.info(f"verifying identity of user")

            try:
              response = await ctx.room.local_participant.perform_rpc(
                destination_identity=participant.identity,
                method='verify_identity',
                payload='',
                response_timeout=5000.0
              )
              print(f"verification identity RPC response: {response}")
              return response
            except Exception as e:
              print(f"verification identity RPC call failed for {participant.identity}: {e}")
              return "Unable to verify user's identity"
        @llm.ai_callable()
        async def update_question(
            self,
            section: Annotated[
                str, llm.TypeInfo(description="The section that the question belongs to")
            ],
            question: Annotated[
                str, llm.TypeInfo(description="The question to be asked to the user")
            ],
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
            logger.info(f"updating question for user {participant.identity}")

            try:
                qa_ref = db.collection(COLLECTIONS['QUESTIONS_ANSWERS']).document(participant.identity)
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
                await self.show_profile_question(section, existing_key or qa_key)
                
                return "Question updated successfully"
                
            except Exception as e:
                print(f"update of question failed for {participant.identity}: {e}")
                return "Unable to update question"

        @llm.ai_callable()
        async def update_answer(
            self,
            question: Annotated[
                str, llm.TypeInfo(description="The question that was asked to the user")
            ],
            answer: Annotated[
                str, llm.TypeInfo(description="The answer received from the user")
            ],
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
            logger.info(f"updating answer for user {participant.identity}")

            try:
                qa_ref = db.collection(COLLECTIONS['QUESTIONS_ANSWERS']).document(participant.identity)
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
                edit_log_ref = db.collection(COLLECTIONS['QA_EDIT_LOGS']).document()
                edit_log_ref.set({
                    'userId': participant.identity,
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
                await self.show_profile_question(section, question_id)
                
                print(f"update of answer successful")
                return "Update of answer successful"
                
            except Exception as e:
                print(f"update of answer failed for {participant.identity}: {e}")
                return "Unable to update answer"

        @llm.ai_callable()
        async def show_profile_modal(self):
            """Opens the user profile modal."""
            try:
                response = await ctx.room.local_participant.perform_rpc(
                    destination_identity=participant.identity,
                    method='show_profile_modal',
                    payload='',
                    response_timeout=5000.0
                )
                return "Successfully opened profile modal"
            except Exception as e:
                logger.error(f"Failed to open profile modal: {e}")
                return "Failed to open profile modal"

        @llm.ai_callable()
        async def show_profile_question(
            self,
            section: Annotated[str, llm.TypeInfo(description="The section name in the profile")],
            question_id: Annotated[str, llm.TypeInfo(description="The ID of the question to highlight")]
        ):
            """Shows the user profile modal and scrolls to a specific question."""
            try:
                # First open the profile modal
                await self.show_profile_modal()
                
                # Then scroll to the specific question
                response = await ctx.room.local_participant.perform_rpc(
                    destination_identity=participant.identity,
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

        @llm.ai_callable()
        async def show_matches(self):
            """Shows the matches modal to the user."""
            try:
                response = await ctx.room.local_participant.perform_rpc(
                    destination_identity=participant.identity,
                    method='show_matches',
                    payload='',
                    response_timeout=5000.0
                )
                return "Successfully opened matches"
            except Exception as e:
                logger.error(f"Failed to show matches: {e}")
                return "Failed to open matches"

        @llm.ai_callable()
        async def manage_wali(
            self,
            action: Annotated[str, llm.TypeInfo(description="The action to perform: 'create' or 'update'")]
        ):
            """Opens the Wali management modal."""
            try:
                response = await ctx.room.local_participant.perform_rpc(
                    destination_identity=participant.identity,
                    method='manage_wali',
                    payload=json.dumps({'action': action}),
                    response_timeout=5000.0
                )
                return "Successfully opened Wali management"
            except Exception as e:
                logger.error(f"Failed to manage Wali: {e}")
                return "Failed to open Wali management"

    fnc_ctx = AssistantFnc()

    def read_pdf_from_firebase(file_path):
        """
        Reads a PDF file from Firebase Storage and converts it to a string,
        preserving structural elements like lists, paragraphs, and formatting.

        :param file_path: The path to the PDF file in Firebase Storage.
        :return: The extracted text from the PDF as a well-formatted string.
        """
        try:
            # Get the PDF file from the storage bucket
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
            
            print(f"Successfully processed PDF with improved formatting")
            print(all_text)
            return all_text
            
        except Exception as e:
            print(f"Error processing PDF {file_path}: {e}")
            return None

    marriage_counselor_instructions = read_pdf_from_firebase("agent-instructions-1.0.pdf")
    
    # Put behavior instructions first, then PDF content for priority
    full_instructions = f"{marriage_counselor_instructions}"

    model = openai.realtime.RealtimeModel(
        model="gpt-4o-mini-realtime-preview",
        modalities=["audio", "text"],
        instructions=full_instructions,
        voice="echo",
        temperature=0.8,
        max_response_output_tokens="inf",
        turn_detection=openai.realtime.ServerVadOptions(
            threshold=0.5,
            prefix_padding_ms=300,
            silence_duration_ms=200,
            create_response=True
        )
    )

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    participant = await ctx.wait_for_participant()

    # First create the agent with empty context
    agent = multimodal.MultimodalAgent(model=model, fnc_ctx=fnc_ctx)
    
    # Initialize ConversationPersistor with the agent
    cp = ConversationPersistor(
        model=agent, 
        user_id=participant.identity,
        transcriptions_only=False
    )

    # Get chat context from logs
    #chat_ctx = await cp.get_chat_context()
    
    # Start the persistor and agent
    cp.start()
    agent.start(ctx.room)
    agent.generate_reply()

    # Initialize session manager and set chat context
    session_manager = SessionManager()
    session_manager.set_current_session(model.sessions[0])

    #if chat_ctx:
    #    await session_manager.current_session.set_chat_ctx(chat_ctx)

    async def check_session_rotation():
        while True:
            try:
                await asyncio.sleep(60)
                if session_manager.needs_rotation():
                    logger.info("Starting session rotation due to duration limit")
                    new_session = await session_manager.rotate_session(model, agent)
                    
                    # Add retry logic for response creation
                    max_retries = 3
                    for i in range(max_retries):
                        try:
                            new_session.response.create()
                            logger.info("Session rotation completed successfully")
                            break
                        except Exception as e:
                            logger.error(f"Attempt {i+1}/{max_retries} failed: {e}")
                            if i == max_retries - 1:
                                raise
                            await asyncio.sleep(1)
                            
            except Exception as e:
                logger.error(f"Error during session rotation: {e}")
                await asyncio.sleep(5)  # Wait before retrying

    rotation_task = asyncio.create_task(check_session_rotation())
    
    async def cleanup():
        logger.info("Starting cleanup")
        try:
            rotation_task.cancel()
            logger.info("Cancelled rotation task")
            await session_manager.current_session.aclose()
            logger.info("Closed current session")
            await cp.aclose()
            logger.info("Closed conversation persistor")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    ctx.add_shutdown_callback(cleanup)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, worker_type=WorkerType.ROOM))

