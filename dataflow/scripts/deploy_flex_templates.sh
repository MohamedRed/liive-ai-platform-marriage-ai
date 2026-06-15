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
IMAGE_NAME_STREAMING="user-matching-pipeline-streaming"
IMAGE_TAG="latest"

# Docker Image Details for Batch Pipeline
IMAGE_NAME_BATCH="user-matching-pipeline-batch"
# You can use the same tag or different tags if needed
# IMAGE_TAG_BATCH="latest"

# Paths to Your Pipeline Scripts and Template Specs
DATAFLOW_DIR="vite-ts/dataflow"
PIPELINES_DIR="$DATAFLOW_DIR/pipelines"
DOCKERFILE_STREAMING="$PIPELINES_DIR/streaming/Dockerfile"
DOCKERFILE_BATCH="$PIPELINES_DIR/batch/Dockerfile"
STREAMING_PIPELINE="$PIPELINES_DIR/streaming/streaming.py"
STREAMING_REQUIREMENTS="$PIPELINES_DIR/streaming/requirements.txt"
STREAMING_METADATA="$PIPELINES_DIR/streaming/template_spec.json"
BATCH_PIPELINE="$PIPELINES_DIR/batch/batch.py"
BATCH_REQUIREMENTS="$PIPELINES_DIR/batch/requirements.txt"
BATCH_METADATA="$PIPELINES_DIR/batch/template_spec.json"

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

# Create separate folders for Streaming and Batch pipelines
create_folder "dataflow/streaming/templates"
create_folder "dataflow/streaming/temp"
create_folder "dataflow/streaming/staging"
create_folder "dataflow/streaming/dlq"

create_folder "dataflow/batch/templates"
create_folder "dataflow/batch/temp"
create_folder "dataflow/batch/staging"
create_folder "dataflow/batch/dlq"

echo "Folder structures created."

# ============================
# Step 5: Grant Permissions
# ============================

echo "Granting Dataflow service account access to the bucket..."
PROJECT_NUMBER=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")
DATAFLOW_SA="service-${PROJECT_NUMBER}@dataflow-service-producer-prod.iam.gserviceaccount.com"

# Grant the Dataflow service account the objectAdmin role on the entire bucket
gsutil iam ch \
    serviceAccount:${DATAFLOW_SA}:roles/storage.objectAdmin \
    gs://${BUCKET_NAME}

# Grant permissions to the Compute Engine service account
echo "Granting roles to Compute Engine default service account..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role=roles/dataflow.admin

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role=roles/dataflow.worker

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role=roles/storage.objectAdmin

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role=roles/artifactregistry.writer

echo "Permissions granted."

# ============================
# Step 6: Build and Push Docker Images
# ============================

# Building and pushing Docker image for Streaming Pipeline
echo "Building and pushing Docker image for Streaming Pipeline..."
gcloud builds submit \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --tag=gcr.io/${PROJECT_ID}/${IMAGE_NAME_STREAMING}:${IMAGE_TAG} \
echo "Docker image for Streaming Pipeline built and pushed to gcr.io/${PROJECT_ID}/${IMAGE_NAME_STREAMING}:${IMAGE_TAG}."

# Building and pushing Docker image for Batch Pipeline
echo "Building and pushing Docker image for Batch Pipeline..."
gcloud builds submit \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --tag=gcr.io/${PROJECT_ID}/${IMAGE_NAME_BATCH}:${IMAGE_TAG} \
echo "Docker image for Batch Pipeline built and pushed to gcr.io/${PROJECT_ID}/${IMAGE_NAME_BATCH}:${IMAGE_TAG}."

# ============================
# Step 7: Build Flex Templates
# ============================

# Building Streaming Flex Template
echo "Building Streaming Flex Template..."
gcloud dataflow flex-template build \
    gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json \
    --image-gcr-path="${REGION}-docker.pkg.dev/${PROJECT_ID}/dataflow-repo/${IMAGE_NAME_STREAMING}:${IMAGE_TAG}" \
    --sdk-language=PYTHON \
    --flex-template-base-image=PYTHON3 \
    --metadata-file="${STREAMING_METADATA}" \
    --py-path="${STREAMING_PIPELINE}" \
    --env "FLEX_TEMPLATE_PYTHON_PY_FILE=streaming.py" \
    --env "FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE=requirements.txt"
echo "Streaming Flex Template built and uploaded to gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json."

# Building Batch Flex Template
echo "Building Batch Flex Template..."
gcloud dataflow flex-template build \
    gs://${BUCKET_NAME}/dataflow/batch/templates/batch.json \
    --image-gcr-path="${REGION}-docker.pkg.dev/${PROJECT_ID}/dataflow-repo/${IMAGE_NAME_BATCH}:${IMAGE_TAG}" \
    --sdk-language=PYTHON \
    --flex-template-base-image=PYTHON3 \
    --metadata-file="${BATCH_METADATA}" \
    --py-path="${BATCH_PIPELINE}" \
    --env "FLEX_TEMPLATE_PYTHON_PY_FILE=batch.py" \
    --env "FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE=requirements.txt"
echo "Batch Flex Template built and uploaded to gs://${BUCKET_NAME}/dataflow/batch/templates/batch.json."

# ============================
# Step 8: Run Dataflow Flex Templates
# ============================

# Running Streaming Flex Template
echo "Running Streaming Flex Template..."
gcloud dataflow flex-template run "streaming-job-`date +%Y%m%d-%H%M%S`" \
    --template-file-gcs-location "gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json" \
    --parameters output="gs://${BUCKET_NAME}/dataflow/streaming/output-" \
    --region "${REGION}"

# Running Batch Flex Template
echo "Running Batch Flex Template..."
gcloud dataflow flex-template run "batch-job-`date +%Y%m%d-%H%M%S`" \
    --template-file-gcs-location "gs://${BUCKET_NAME}/dataflow/batch/templates/batch.json" \
    --parameters output="gs://${BUCKET_NAME}/dataflow/batch/output-" \
    --region "${REGION}"

# ============================
# Step 9: Deployment Confirmation
# ============================

echo "Deployment of Flex Templates completed successfully!"
echo "Templates are available at:"
echo " - Streaming: gs://${BUCKET_NAME}/dataflow/streaming/templates/streaming.json"
echo " - Batch: gs://${BUCKET_NAME}/dataflow/batch/templates/batch.json"
