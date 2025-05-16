#!/bin/bash
set -e

# ============================
# Configuration - Update Below
# ============================

# GCP Project ID
PROJECT_ID="marriage-ai-289c6"

# GCP Region (e.g., us-central1)
REGION="us-central1"

# Google Cloud Storage Bucket Name
BUCKET_NAME="marriage-ai-289c6.firebasestorage.app"

# Docker Image Details for Streaming Pipeline
IMAGE_NAME_STREAMING="streaming-pipeline"
IMAGE_TAG="latest"

# Template paths and metadata
TEMPLATE_PATH="gs://${BUCKET_NAME}/dataflow/streaming/staging"
STREAMING_METADATA="template_spec.json"

# Pipeline parameters
PINECONE_REGION="us-central1"
PROFILES_COLLECTION="PROFILES"
PINECONE_INDEX="profiles"
MATCHES_COLLECTION="MATCHES"
TOP_K="10"

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
if gcloud artifacts repositories describe dataflow-repo --location=${REGION} --project=${PROJECT_ID} > /dev/null 2>&1; then
    echo "Artifact Registry repository 'dataflow-repo' already exists."
else
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create dataflow-repo \
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
# Step 5: Build and Deploy Template
# ============================

# Building Streaming Flex Template
echo "Building Streaming Flex Template..."
gcloud dataflow flex-template build \
    gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json \
    --image-gcr-path="${REGION}-docker.pkg.dev/${PROJECT_ID}/dataflow-repo/${IMAGE_NAME_STREAMING}:${IMAGE_TAG}" \
    --sdk-language=PYTHON \
    --flex-template-base-image=PYTHON3 \
    --metadata-file="${STREAMING_METADATA}" \
    --py-path="." \
    --env "FLEX_TEMPLATE_PYTHON_PY_FILE=streaming.py" \
    --env "FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE=requirements.txt"
echo "Streaming Flex Template built and uploaded to gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json."

# ============================
# Step 6: Run Template
# ============================

# Running Streaming Flex Template
echo "Running Streaming Flex Template..."
gcloud dataflow flex-template run "streaming-job-`date +%Y%m%d-%H%M%S`" \
    --template-file-gcs-location "gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json" \
    --parameters \
dlq_bucket="gs://${BUCKET_NAME}/dataflow/streaming/dlq",\
project="${PROJECT_ID}",\
pinecone_region="${PINECONE_REGION}",\
pinecone_index="${PINECONE_INDEX}",\
profiles_collection="${PROFILES_COLLECTION}",\
matches_collection="${MATCHES_COLLECTION}",\
top_k="${TOP_K}",\
staging_location="gs://${BUCKET_NAME}/dataflow/streaming/staging",
temp_location="gs://${BUCKET_NAME}/dataflow/streaming/temp" \
user_profile_updated_pubsub_topic="projects/${PROJECT_ID}/topics/user-profile-updated",\
delayed_matching_pubsub_topic="projects/${PROJECT_ID}/topics/delayed-matching" \
    --region "${REGION}"

# ============================
# Step 7: Deployment Confirmation
# ============================

echo "Deployment of Flex Templates completed successfully!"
echo "Templates are available at:"
echo " - Streaming: gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json"