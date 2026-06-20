#!/bin/bash
set -e

# ============================
# Configuration - Update Below
# ============================

# GCP Project ID
PROJECT_ID="marriage-ai-289c6"

# GCP Region (e.g., us-central1)
REGION="us-central1"

# Google Cloud Storage Bucket Name (Ensure this is the bucket, not the firebase storage path)
BUCKET_NAME="marriage-ai-289c6-dataflow-assets" # Example: Adjust if needed

# Docker Image Details for Streaming Pipeline
ARTIFACT_REPO="dataflow-repo" # Repository name in Artifact Registry
IMAGE_NAME_STREAMING="streaming-pipeline"
IMAGE_TAG="latest"

# Template paths and metadata
TEMPLATE_BUCKET_PATH="gs://${BUCKET_NAME}/dataflow/streaming"
STREAMING_METADATA="template_spec.json"

# Pipeline parameters (Add defaults or ensure they are passed/configured elsewhere)
# Use placeholder values if they need to be overridden at runtime, but define them
PINECONE_INDEX="profiles"
PINECONE_REGION="us-central1-gcp" # Example value, replace with your Pinecone env
PROFILES_COLLECTION="USERS"
MATCHES_COLLECTION="MATCHES"
TOP_K="20"
PDF_BUCKET="your-pdf-bucket-name" # *** REPLACE WITH ACTUAL BUCKET ***
PDF_INSTRUCTIONS_PATH="agent-instructions-1.0.pdf"
TASKS_LOCATION="us-central1"
DELAYED_MATCHING_QUEUE="delayed-matching"
NOTIFICATION_QUEUE="match-notifications"
VOICE_AGENT_QUEUE="voice-agent-calls"
NOTIFICATION_FUNCTION_URL="YOUR_NOTIFICATION_FUNCTION_URL" # *** REPLACE ***
VOICE_AGENT_FUNCTION_URL="YOUR_VOICE_AGENT_FUNCTION_URL"   # *** REPLACE ***
DELAYED_TASK_DELAY_SECONDS="300"
DATAFLOW_WORKER_SA="YOUR_DATAFLOW_WORKER_SA_EMAIL" # *** REPLACE ***
IMMEDIATE_TOPIC="user-profile-updated" # Example topic name
DELAYED_TOPIC="delayed-matching" # Example topic name

# Construct derived variables
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
    --project=${PROJECT_ID}

# ============================
# Step 2: Create GCS Bucket
# ============================

echo "Creating Google Cloud Storage bucket if it doesn't exist..."
if gsutil ls -b gs://${BUCKET_NAME} > /dev/null 2>&1; then
    echo "Bucket gs://${BUCKET_NAME} already exists."
else
    gsutil mb -p ${PROJECT_ID} -l ${REGION} gs://${BUCKET_NAME}
    echo "Bucket gs://${BUCKET_NAME} created."
fi

# ============================
# Step 3: Create Artifact Registry Repository
# ============================

echo "Checking if Artifact Registry repository exists..."
if gcloud artifacts repositories describe ${ARTIFACT_REPO} --location=${REGION} --project=${PROJECT_ID} > /dev/null 2>&1; then
    echo "Artifact Registry repository '${ARTIFACT_REPO}' already exists."
else
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create ${ARTIFACT_REPO} \
        --repository-format=docker \
        --location=${REGION} \
        --project=${PROJECT_ID}
    echo "Artifact Registry repository created."
fi

# ============================
# Step 4: Create Folder Structures in GCS Bucket
# ============================

echo "Creating folder structure in the bucket..."

# Function to create a "folder" by uploading a placeholder file
create_folder() {
    local folder_path=$1
    gsutil ls gs://${BUCKET_NAME}/${folder_path}/ > /dev/null 2>&1 || {
        touch placeholder
        gsutil cp placeholder gs://${BUCKET_NAME}/${folder_path}/
        rm placeholder
        echo "Created folder: gs://${BUCKET_NAME}/${folder_path}/"
    }
}

# Create separate folders for Streaming pipelines
create_folder "dataflow/streaming/templates"
create_folder "dataflow/streaming/temp"
create_folder "dataflow/streaming/staging"
create_folder "dataflow/streaming/dlq"

echo "Folder structures created."

# ============================
# Step 5: Build and Deploy Template (Corrected Build Command)
# ============================

echo "Building Streaming Flex Template..."
# Assuming Dockerfile and requirements.txt are in the current directory relative to script execution
gcloud dataflow flex-template build ${TEMPLATE_SPEC_GCS_PATH} \
    --image "${IMAGE_PATH}" \
    --sdk-language PYTHON \
    --metadata-file "${STREAMING_METADATA}" \
    --requirements-file ./requirements.txt # Path relative to where command is run
    # Removed: --flex-template-base-image, --py-path, --env flags

echo "Streaming Flex Template built and uploaded to ${TEMPLATE_SPEC_GCS_PATH}."

# ============================
# Step 6: Run Template (Corrected Run Command with All Parameters)
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

# Add other Dataflow options like --max-workers, --machine-type if needed.

echo "Streaming job started."

# ============================
# Step 7: Deployment Confirmation
# ============================

echo "Deployment script completed! Check the GCP console for job status."
echo "Template Spec: ${TEMPLATE_SPEC_GCS_PATH}"