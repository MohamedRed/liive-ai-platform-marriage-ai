#!/bin/bash
set -e

# ============================
# Step 1: Configuration
# ============================

PROJECT_ID="marriage-ai-289c6"
REGION="us-central1"
BUCKET_NAME="${PROJECT_ID}.firebasestorage.app"

# Pipeline configurations
STREAMING_PIPELINE="streaming.py"
STREAMING_REQUIREMENTS="requirements.txt"
STREAMING_METADATA="template_spec.json"

# Image configurations
IMAGE_NAME_STREAMING="user-matching-pipeline-streaming"
IMAGE_TAG="latest"
IMAGE_PATH="${REGION}-docker.pkg.dev/${PROJECT_ID}/dataflow-repo/${IMAGE_NAME_STREAMING}:${IMAGE_TAG}"

# ============================
# Step 2: Build and Push Docker Image
# ============================

echo "Building and pushing Docker image..."
gcloud builds submit --tag "${IMAGE_PATH}" .

# ============================
# Step 3: Build Flex Template
# ============================

echo "Building Streaming Flex Template..."
gcloud dataflow flex-template build \
    "gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json" \
    --image-gcr-path="${IMAGE_PATH}" \
    --sdk-language=PYTHON \
    --flex-template-base-image=PYTHON3 \
    --metadata-file="${STREAMING_METADATA}" \
    --py-path="." \
    --env "FLEX_TEMPLATE_PYTHON_PY_FILE=${STREAMING_PIPELINE}" \
    --env "FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE=${STREAMING_REQUIREMENTS}"

# ============================
# Step 4: Run Flex Template
# ============================

PINECONE_REGION="us-central1"
PROFILES_COLLECTION="PROFILES"
PINECONE_INDEX="profiles"
MATCHES_COLLECTION="MATCHES"
TOP_K="10"

echo "Running Streaming Flex Template..."
gcloud dataflow flex-template run "streaming-job-`date +%Y%m%d-%H%M%S`" \
    --template-file-gcs-location "gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json" \
    --parameters pubsub_topic="projects/${PROJECT_ID}/topics/user-profile-update-topic",\
dlq_bucket="gs://${BUCKET_NAME}/dataflow/streaming/dlq",\
project="${PROJECT_ID}",\
pinecone_region="${PINECONE_REGION}",\
pinecone_index="${PINECONE_INDEX}",\
profiles_collection="${PROFILES_COLLECTION}",\
matches_collection="${MATCHES_COLLECTION}",\
top_k="${TOP_K}",\
staging_location="gs://${BUCKET_NAME}/dataflow/streaming/staging",\
temp_location="gs://${BUCKET_NAME}/dataflow/streaming/temp" \
    --region "${REGION}"

# ============================
# Step 5: Deployment Confirmation
# ============================

echo "Deployment completed successfully!"
echo "Template available at: gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json"