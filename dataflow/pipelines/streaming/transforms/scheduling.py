# apps/marriage-ai/dataflow/pipelines/streaming/transforms/scheduling.py
import apache_beam as beam
import logging
import time
import base64
import json
import traceback
from datetime import datetime, timedelta

# Import third-party libraries used within DoFns
from google.cloud import tasks_v2, firestore
from apache_beam.metrics import Metrics

# Import constants and metrics from common
from .common import MetricNames, COLLECTIONS

logger = logging.getLogger(__name__)

class ScheduleDelayedMatchingDoFn(beam.DoFn):
    """Schedules a delayed matching task using Cloud Tasks after immediate matching is done"""
    def __init__(self, project_id: str, location: str, queue_name: str, topic_name: str, delay_seconds: int = 300):
        self.project_id = project_id
        self.location = location # e.g., 'us-central1'
        self.queue_name = queue_name # e.g., 'delayed-matching'
        self.topic_name = topic_name # e.g., 'delayed-matching' (PubSub topic)
        self.delay_seconds = delay_seconds # Delay in seconds (default 5 mins)
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('ScheduleDelayedMatchingDoFn', MetricNames.ERRORS)
        self.tasks_created_counter = Metrics.counter('ScheduleDelayedMatchingDoFn', 'tasks_created')
        self.tasks_client = None
        self.db = None

    def setup(self):
        try:
            self.tasks_client = tasks_v2.CloudTasksClient()
            self.db = firestore.Client(project=self.project_id)
            self.logger.info("ScheduleDelayedMatchingDoFn setup complete (Cloud Tasks & Firestore)")
        except Exception as e:
             self.logger.error(f"Failed ScheduleDelayedMatchingDoFn setup: {e}", exc_info=True)
             raise

    def process(self, element):
        # Expecting element like {'user_id': ..., 'matches': [...], 'query_time': ...} from QueryPinecone
        if not self.tasks_client or not self.db:
             self.logger.error("Clients not initialized in ScheduleDelayedMatchingDoFn. Skipping.")
             self.error_counter.inc()
             raise RuntimeError("Setup failed for ScheduleDelayedMatchingDoFn")

        if not isinstance(element, dict) or 'user_id' not in element:
            self.logger.error(f"Invalid input element format for ScheduleDelayedMatchingDoFn: {element}")
            self.error_counter.inc()
            return

        user_id = element['user_id']
        query_time = element.get('query_time') # Timestamp from Pinecone query step

        try:
            if not query_time:
                self.logger.warning(f"No query_time found for user {user_id} in element. Using current time + delay for scheduling.")
                schedule_timestamp = time.time() + self.delay_seconds
            else:
                # Schedule task for specified seconds after the Pinecone query time
                schedule_timestamp = query_time + self.delay_seconds

            schedule_dt = datetime.utcfromtimestamp(schedule_timestamp)
            self.logger.info(f"Scheduling delayed matching task for user {user_id} at {schedule_dt.isoformat()}Z")

            # Construct the Cloud Tasks queue path
            queue_path = self.tasks_client.queue_path(
                self.project_id,
                self.location,
                self.queue_name
            )

            # Construct the Pub/Sub topic path
            pubsub_topic_path = f'projects/{self.project_id}/topics/{self.topic_name}'

            # Prepare payload for Pub/Sub message
            pubsub_payload = {
                'userId': user_id,
                'eventType': 'delayed_matching', # Add event type for clarity
                'scheduledAt': schedule_dt.isoformat() + 'Z'
            }
            pubsub_data = base64.b64encode(json.dumps(pubsub_payload).encode('utf-8')).decode('utf-8')

            # Prepare attributes (must be strings)
            pubsub_attributes = {'userId': str(user_id)} # Ensure userId attribute is string

            # Create the task request
            task = tasks_v2.Task(
                schedule_time=tasks_v2.Timestamp(seconds=int(schedule_timestamp)),
                pubsub_target=tasks_v2.PubsubTarget(
                    topic_name=pubsub_topic_path,
                    data=pubsub_data,
                    attributes=pubsub_attributes
                )
            )

            # Create the task
            response = self.tasks_client.create_task(
                request=tasks_v2.CreateTaskRequest(parent=queue_path, task=task)
            )
            self.tasks_created_counter.inc()
            self.logger.info(f"Successfully scheduled delayed matching task {response.name} for user {user_id}")

            # Store task info in Firestore for potential cancellation/tracking
            # Use a dedicated collection, e.g., 'delayed_matching_tasks'
            task_tracking_ref = self.db.collection('delayed_matching_tasks').document(user_id)
            task_tracking_ref.set({
                'taskName': response.name,
                'scheduledTime': firestore.Timestamp.fromtimestamp(schedule_timestamp),
                'status': 'SCHEDULED', # Track status
                'createdAt': firestore.SERVER_TIMESTAMP
            }, merge=True) # Use merge=True to update if exists

            # Yield the original element to allow further processing if needed
            yield element

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Failed to schedule delayed matching task for user {user_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            # Raise error to be caught by DLQ if scheduling fails
            raise


class HandleMatchActionsDoFn(beam.DoFn):
    """Handles post-match actions (notifications or AI voice agent calls) via Cloud Tasks."""
    def __init__(self, project_id: str, location: str, notification_queue: str, voice_agent_queue: str, notification_function_url: str, voice_agent_function_url: str):
        self.project_id = project_id
        self.location = location
        self.notification_queue = notification_queue
        self.voice_agent_queue = voice_agent_queue
        self.notification_function_url = notification_function_url
        self.voice_agent_function_url = voice_agent_function_url
        self.logger = logging.getLogger(__name__)
        self.error_counter = Metrics.counter('HandleMatchActionsDoFn', MetricNames.ERRORS)
        self.notifications_scheduled = Metrics.counter('HandleMatchActionsDoFn', 'notifications_scheduled')
        self.voice_calls_scheduled = Metrics.counter('HandleMatchActionsDoFn', 'voice_calls_scheduled')
        self.settings_not_found = Metrics.counter('HandleMatchActionsDoFn', 'settings_not_found')
        self.db = None
        self.tasks_client = None

    def setup(self):
        try:
            self.db = firestore.Client(project=self.project_id)
            self.tasks_client = tasks_v2.CloudTasksClient()
            self.logger.info("HandleMatchActionsDoFn setup complete (Firestore & Cloud Tasks)")
        except Exception as e:
             self.logger.error(f"Failed HandleMatchActionsDoFn setup: {e}", exc_info=True)
             raise

    def _check_notification_availability(self, prefs):
        """Checks notification availability based on user preferences. Matches TypeScript logic."""
        if not prefs:
            return True  # Default to available if no preferences set

        try:
            # Use UTC or a consistent timezone if prefs relate to specific times
            now = datetime.now() # Assumes worker timezone is acceptable, consider UTC: datetime.utcnow()
            current_hour = now.hour
            # Ensure consistent case and format (e.g., 'monday')
            current_day = now.strftime('%A').lower()

            # Check enabled flag first
            if not prefs.get('enabled', True):
                 return False

            # Check quiet hours
            quiet_hours = prefs.get('quietHours')
            if quiet_hours and isinstance(quiet_hours, dict):
                start = int(quiet_hours.get('start', 22))
                end = int(quiet_hours.get('end', 6))
                # Handle overnight quiet hours
                if start <= end:
                    # Quiet hours within the same day (e.g., 9 to 17 means quiet outside this)
                    # This logic seems reversed in original? Let's assume standard quiet hours:
                    # Quiet between start and end
                    if current_hour >= start and current_hour < end:
                         return False
                else: # Overnight (e.g., 22 to 6)
                    if current_hour >= start or current_hour < end:
                         return False

            # Check available days (Map: day_name -> boolean)
            available_days = prefs.get('availableDays')
            if available_days and isinstance(available_days, dict):
                # Check if today exists in the map and if it's set to False
                if current_day in available_days and available_days[current_day] is False:
                     return False
                # If day is not in map, assume available? Or default to unavailable?
                # Assuming default available if not specified.

            # Check available hours for the current day (Map: day_name -> {start, end})
            available_hours = prefs.get('availableHours')
            if available_hours and isinstance(available_hours, dict) and current_day in available_hours:
                day_hours = available_hours[current_day]
                if isinstance(day_hours, dict):
                     start = int(day_hours.get('start', 0))
                     end = int(day_hours.get('end', 24))

                     # Check if current time is *within* the available range
                     if start <= end:
                          if not (current_hour >= start and current_hour < end):
                               return False # Not within the range
                     else: # Overnight availability (e.g., 20 to 9)
                          if not (current_hour >= start or current_hour < end):
                               return False # Not within the overnight range

            # If none of the checks returned False, assume available
            return True
        except Exception as e:
             self.logger.error(f"Error checking notification availability: {e}", exc_info=True)
             # Default to available on error to avoid blocking notifications due to bad settings
             return True

    def _schedule_task(self, queue_name: str, function_url: str, payload: dict):
        """Helper function to create and schedule a Cloud Task targeting an HTTP function."""
        try:
            queue_path = self.tasks_client.queue_path(self.project_id, self.location, queue_name)
            task_payload_bytes = json.dumps(payload).encode('utf-8')

            task = tasks_v2.Task(
                http_request=tasks_v2.HttpRequest(
                    http_method=tasks_v2.HttpMethod.POST,
                    url=function_url,
                    headers={"Content-Type": "application/json"},
                    body=task_payload_bytes
                    # Add OIDC token for authenticated Cloud Functions V2 / Cloud Run
                    # oidc_token=tasks_v2.OidcToken(
                    #     service_account_email=SERVICE_ACCOUNT_EMAIL # Needs service account email
                    # )
                )
                # Can add schedule_time if needed, otherwise runs ASAP
            )

            response = self.tasks_client.create_task(request={"parent": queue_path, "task": task})
            self.logger.info(f"Scheduled task {response.name} on queue {queue_name} for user {payload.get('userId')}")
            return True
        except Exception as e:
             user_id = payload.get('userId', '[UNKNOWN]')
             self.logger.error(f"Failed to schedule task on queue {queue_name} for user {user_id}: {e}", exc_info=True)
             self.error_counter.inc()
             # Don't raise here, just log the failure for this specific action
             return False

    def process(self, element):
        # Expecting element like {'user_id': ..., 'matches': [...]} from RerankMatchesDoFn
        if not self.db or not self.tasks_client:
             self.logger.error("Clients not initialized in HandleMatchActionsDoFn. Skipping.")
             self.error_counter.inc()
             raise RuntimeError("Setup failed for HandleMatchActionsDoFn")

        if not isinstance(element, dict) or 'user_id' not in element or 'matches' not in element:
            self.logger.error(f"Invalid input element format for HandleMatchActionsDoFn: {element}")
            self.error_counter.inc()
            return

        user_id = element['user_id']
        matches = element.get('matches', []) # Reranked matches

        try:
            # Get user settings - use COLLECTIONS constant
            settings_ref = self.db.collection(COLLECTIONS['USER_SETTINGS']).document(user_id)
            user_settings_doc = settings_ref.get()

            if not user_settings_doc.exists:
                self.logger.warning(f"No settings found for user {user_id}. Cannot determine match actions.")
                self.settings_not_found.inc()
                # Yield element anyway, as processing is done, just actions skipped
                yield element
                return

            user_settings = user_settings_doc.to_dict()
            # Extract notification preferences using the structure defined (e.g., in TypeScript interfaces)
            notification_prefs = user_settings.get('notification', {}).get('preferences', {})

            # Process actions for each match *that has suggested questions*
            for match in matches:
                match_id = match.get('id')
                suggested_questions = match.get('suggested_questions', [])

                # Only trigger actions if there are suggested questions
                if match_id and suggested_questions:
                    # Check user availability based on preferences
                    is_available = self._check_notification_availability(notification_prefs)

                    if is_available:
                        # Schedule push notification / in-app message
                        payload = {
                            'userId': user_id,
                            'matchId': match_id,
                            'score': match.get('ai_score', 0.0),
                            'questions': suggested_questions
                            # Add any other relevant info for the notification function
                        }
                        if self._schedule_task(self.notification_queue, self.notification_function_url, payload):
                             self.notifications_scheduled.inc()
                    else:
                        # User is unavailable for notifications, schedule AI voice agent call
                        self.logger.info(f"User {user_id} unavailable for notification, scheduling voice agent call for match {match_id}.")
                        payload = {
                            'userId': user_id,
                            'matchId': match_id,
                            'score': match.get('ai_score', 0.0),
                            'questions': suggested_questions
                            # Add any other relevant info for the voice agent function
                        }
                        if self._schedule_task(self.voice_agent_queue, self.voice_agent_function_url, payload):
                             self.voice_calls_scheduled.inc()

            # Yield the original element after processing actions
            yield element

        except Exception as e:
            self.error_counter.inc()
            self.logger.error(f"Error handling match actions for user {user_id}: {str(e)}\nTraceback: {traceback.format_exc()}", exc_info=True)
            # Don't raise here to avoid blocking other elements, let DLQ handle the original element if needed
            # However, the original pipeline raised from some DoFns, so consistency might require raising.
            # If this step is considered non-critical, logging might be sufficient.
            # For now, maintain consistency if other steps raise:
            raise


# --- Composite PTransforms --- #

@beam.ptransform_fn
def ScheduleDelayedMatching(pcoll: beam.PCollection[dict], project_id: str, location: str, queue_name: str, topic_name: str, delay_seconds: int = 300) -> beam.PCollection[dict]:
    """Composite PTransform to schedule delayed matching tasks.

    Args:
        pcoll: PCollection of dictionaries from Pinecone query.
        project_id: GCP Project ID.
        location: Cloud Tasks location (e.g., 'us-central1').
        queue_name: Cloud Tasks queue name for delayed matching.
        topic_name: PubSub topic name for delayed matching tasks.
        delay_seconds: Delay in seconds before task execution.

    Returns:
        Input PCollection passed through.
    """
    return (
        pcoll
        | "ScheduleDelayedMatchingTask" >> beam.ParDo(ScheduleDelayedMatchingDoFn(
            project_id=project_id,
            location=location,
            queue_name=queue_name,
            topic_name=topic_name,
            delay_seconds=delay_seconds
        ))
    )

@beam.ptransform_fn
def HandleMatchActions(pcoll: beam.PCollection[dict], project_id: str, location: str, notification_queue: str, voice_agent_queue: str, notification_function_url: str, voice_agent_function_url: str) -> beam.PCollection[dict]:
    """Composite PTransform to handle post-match actions (notifications/voice agent).

    Args:
        pcoll: PCollection of dictionaries containing reranked matches.
        project_id: GCP Project ID.
        location: Cloud Tasks location.
        notification_queue: Cloud Tasks queue for notifications.
        voice_agent_queue: Cloud Tasks queue for voice agent calls.
        notification_function_url: URL of the notification Cloud Function/Run service.
        voice_agent_function_url: URL of the voice agent Cloud Function/Run service.

    Returns:
        Input PCollection passed through.
    """
    return (
        pcoll
        | "HandleNotificationsOrVoiceAgent" >> beam.ParDo(HandleMatchActionsDoFn(
            project_id=project_id,
            location=location,
            notification_queue=notification_queue,
            voice_agent_queue=voice_agent_queue,
            notification_function_url=notification_function_url,
            voice_agent_function_url=voice_agent_function_url
        ))
    ) 