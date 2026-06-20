#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

DEPLOY_CONFIG="${DEPLOY_CONFIG:-${SCRIPT_DIR}/deploy_flex_templates.env}"
if [[ -f "${DEPLOY_CONFIG}" ]]; then
    echo "Streaming deploy config: ${DEPLOY_CONFIG}"
    set -a
    # shellcheck source=/dev/null
    source "${DEPLOY_CONFIG}"
    set +a
else
    echo "Streaming deploy config file not found at ${DEPLOY_CONFIG}; using environment only."
fi

required_var() {
    local name="$1"
    if [[ -z "${!name:-}" ]]; then
        echo "Missing required deploy config: ${name}. Set it in DEPLOY_CONFIG=${DEPLOY_CONFIG} or export it in the environment." >&2
        exit 2
    fi
}

required_var PROJECT_ID
required_var REGION
required_var BUCKET_NAME
required_var ARTIFACT_REPO
required_var IMAGE_NAME_STREAMING
required_var IMAGE_TAG
required_var PINECONE_INDEX
required_var PINECONE_REGION
required_var TOP_K
required_var PDF_BUCKET
required_var PDF_INSTRUCTIONS_PATH
required_var TASKS_LOCATION
required_var DELAYED_MATCHING_QUEUE
required_var NOTIFICATION_QUEUE
required_var VOICE_AGENT_QUEUE
required_var NOTIFICATION_FUNCTION_URL
required_var VOICE_AGENT_FUNCTION_URL
required_var DELAYED_TASK_DELAY_SECONDS
required_var DATAFLOW_WORKER_SA
required_var IMMEDIATE_TOPIC
required_var DELAYED_TOPIC

STREAMING_METADATA="${STREAMING_METADATA:-template_spec.json}"
TEMPLATE_BUCKET_PATH="gs://${BUCKET_NAME}/dataflow/streaming"
IMAGE_PATH="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO}/${IMAGE_NAME_STREAMING}:${IMAGE_TAG}"
TEMPLATE_SPEC_GCS_PATH="${TEMPLATE_BUCKET_PATH}/templates/streaming.json"
STAGING_LOCATION="${TEMPLATE_BUCKET_PATH}/staging"
TEMP_LOCATION="${TEMPLATE_BUCKET_PATH}/temp"
DLQ_GCS_PATH="${TEMPLATE_BUCKET_PATH}/dlq/"
IMMEDIATE_PUBSUB_TOPIC="projects/${PROJECT_ID}/topics/${IMMEDIATE_TOPIC}"
DELAYED_PUBSUB_TOPIC="projects/${PROJECT_ID}/topics/${DELAYED_TOPIC}"

# ============================
# Step 1: Enable Required Services
# ============================

echo "Enabling required services..."
gcloud services enable dataflow compute_component logging storage_component \
    storage_api cloudresourcemanager.googleapis.com \
    artifactregistry.googleapis.com cloudbuild.googleapis.com \
    --project="${PROJECT_ID}"

# ============================
# Step 2: Create GCS Bucket
# ============================

echo "Creating Google Cloud Storage bucket if it doesn't exist..."
if gsutil ls -b "gs://${BUCKET_NAME}" > /dev/null 2>&1; then
    echo "Bucket gs://${BUCKET_NAME} already exists."
else
    gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${BUCKET_NAME}"
    echo "Bucket gs://${BUCKET_NAME} created."
fi

# ============================
# Step 3: Create Artifact Registry Repository
# ============================

echo "Checking if Artifact Registry repository exists..."
if gcloud artifacts repositories describe "${ARTIFACT_REPO}" --location="${REGION}" --project="${PROJECT_ID}" > /dev/null 2>&1; then
    echo "Artifact Registry repository '${ARTIFACT_REPO}' already exists."
else
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create "${ARTIFACT_REPO}" \
        --repository-format=docker \
        --location="${REGION}" \
        --project="${PROJECT_ID}"
    echo "Artifact Registry repository created."
fi

# ============================
# Step 4: Create Folder Structures in GCS Bucket
# ============================

echo "Creating folder structure in the bucket..."
create_folder() {
    local folder_path=$1
    if gsutil ls "gs://${BUCKET_NAME}/${folder_path}/" > /dev/null 2>&1; then
        return
    fi
    local placeholder
    placeholder="$(mktemp)"
    gsutil cp "${placeholder}" "gs://${BUCKET_NAME}/${folder_path}/placeholder"
    rm -f "${placeholder}"
    echo "Created folder: gs://${BUCKET_NAME}/${folder_path}/"
}

create_folder "dataflow/streaming/templates"
create_folder "dataflow/streaming/temp"
create_folder "dataflow/streaming/staging"
create_folder "dataflow/streaming/dlq"

echo "Folder structures created."

# ============================
# Step 5: Preflight Runtime Resources
# ============================

echo "Running streaming deployment preflight checks..."
python3 scripts/preflight_deploy.py \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --service-account-email "${DATAFLOW_WORKER_SA}" \
    --immediate-topic "${IMMEDIATE_TOPIC}" \
    --delayed-topic "${DELAYED_TOPIC}" \
    --tasks-location "${TASKS_LOCATION}" \
    --delayed-matching-queue "${DELAYED_MATCHING_QUEUE}" \
    --notification-queue "${NOTIFICATION_QUEUE}" \
    --voice-agent-queue "${VOICE_AGENT_QUEUE}" \
    --pdf-bucket "${PDF_BUCKET}" \
    --pdf-instructions-path "${PDF_INSTRUCTIONS_PATH}" \
    --notification-function-url "${NOTIFICATION_FUNCTION_URL}" \
    --voice-agent-function-url "${VOICE_AGENT_FUNCTION_URL}" \
    --pinecone-index "${PINECONE_INDEX}" \
    --pinecone-region "${PINECONE_REGION}"

# ============================
# Step 6: Build and Deploy Template
# ============================

echo "Building Streaming Flex Template..."
gcloud dataflow flex-template build "${TEMPLATE_SPEC_GCS_PATH}" \
    --image "${IMAGE_PATH}" \
    --sdk-language PYTHON \
    --metadata-file "${STREAMING_METADATA}" \
    --requirements-file ./requirements.txt

echo "Streaming Flex Template built and uploaded to ${TEMPLATE_SPEC_GCS_PATH}."

# ============================
# Step 7: Run Template
# ============================

echo "Running Streaming Flex Template..."
gcloud dataflow flex-template run "streaming-job-$(date +%Y%m%d-%H%M%S)" \
    --template-file-gcs-location "${TEMPLATE_SPEC_GCS_PATH}" \
    --region "${REGION}" \
    --service-account-email "${DATAFLOW_WORKER_SA}" \
    --staging-location "${STAGING_LOCATION}" \
    --temp-location "${TEMP_LOCATION}" \
    --parameters project="${PROJECT_ID}" \
    --parameters region="${REGION}" \
    --parameters runner="DataflowRunner" \
    --parameters temp_location="${TEMP_LOCATION}" \
    --parameters staging_location="${STAGING_LOCATION}" \
    --parameters service_account_email="${DATAFLOW_WORKER_SA}" \
    --parameters requirements_file="/template/requirements.txt" \
    --parameters user_profile_updated_pubsub_topic="${IMMEDIATE_PUBSUB_TOPIC}" \
    --parameters delayed_matching_pubsub_topic="${DELAYED_PUBSUB_TOPIC}" \
    --parameters pinecone_index="${PINECONE_INDEX}" \
    --parameters pinecone_region="${PINECONE_REGION}" \
    --parameters top_k="${TOP_K}" \
    --parameters pdf_bucket="${PDF_BUCKET}" \
    --parameters pdf_instructions_path="${PDF_INSTRUCTIONS_PATH}" \
    --parameters tasks_location="${TASKS_LOCATION}" \
    --parameters delayed_matching_queue="${DELAYED_MATCHING_QUEUE}" \
    --parameters notification_queue="${NOTIFICATION_QUEUE}" \
    --parameters voice_agent_queue="${VOICE_AGENT_QUEUE}" \
    --parameters notification_function_url="${NOTIFICATION_FUNCTION_URL}" \
    --parameters voice_agent_function_url="${VOICE_AGENT_FUNCTION_URL}" \
    --parameters delayed_task_delay_seconds="${DELAYED_TASK_DELAY_SECONDS}" \
    --parameters dlq_gcs_path="${DLQ_GCS_PATH}"

echo "Streaming job started."

# ============================
# Step 8: Deployment Confirmation
# ============================

echo "Deployment script completed! Check the GCP console for job status."
echo "Template Spec: ${TEMPLATE_SPEC_GCS_PATH}"
