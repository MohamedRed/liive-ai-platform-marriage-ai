# Marriage AI Dataflow Module

This module contains Apache Beam data processing pipelines for the Marriage AI platform, enabling real-time user matching and profile processing at scale.

## Overview

The Dataflow module implements data processing pipelines that:

1. **Process user profile data** in real-time and batch modes
2. **Generate embeddings** of user profiles using OpenAI
3. **Match users** based on compatibility scoring and vector similarity
4. **Calculate trust scores** for user responses
5. **Update matches in Firestore** when user profiles change

These pipelines are designed to run on Google Cloud Dataflow, Google's fully managed service for executing Apache Beam pipelines.

## Directory Structure

```
dataflow/
├── pipelines/                   # Pipeline implementations
│   ├── batch/                   # Batch processing pipeline
│   │   ├── batch.py             # Main batch pipeline code
│   │   ├── Dockerfile           # Container definition for batch pipeline
│   │   ├── requirements.txt     # Python dependencies
│   │   └── template_spec.json   # Flex template specification
│   └── streaming/               # Streaming processing pipeline
│       ├── streaming.py         # Main streaming pipeline code
│       ├── Dockerfile           # Container definition for streaming pipeline
│       ├── requirements.txt     # Python dependencies
│       └── template_spec.json   # Flex template specification
├── scripts/                     # Utility scripts
│   ├── deploy_flex_templates.sh # Script to build and deploy pipeline templates
│   ├── create_test_profiles.py  # Script to generate test user profiles
│   └── simulate_streaming_updates.py # Script to simulate streaming events
└── setup.py                     # Package setup file
```

## Pipeline Types

### Streaming Pipeline (`pipelines/streaming/streaming.py`)

The streaming pipeline processes user profile updates in real-time:

1. Listens for user profile update events from Pub/Sub
2. Fetches complete user profiles from Firestore
3. Generates embeddings for user profiles using OpenAI
4. Stores embeddings in Pinecone vector database
5. Queries for potential matches based on vector similarity
6. Reranks matches based on compatibility scoring
7. Calculates truth/lying scores for user responses
8. Updates matches in Firestore
9. Optionally triggers notifications or voice agent interactions

### Batch Pipeline (`pipelines/batch/batch.py`)

The batch pipeline processes user profiles in bulk:

1. Processes all user profiles periodically
2. Updates embeddings for all users
3. Regenerates matches for all users
4. Updates the match database in bulk
5. Can be scheduled to run daily/weekly

## Prerequisites

Before using this module, you'll need:

- Google Cloud Platform account with Dataflow API enabled
- Apache Beam SDK for Python
- Access to OpenAI API for embeddings
- Pinecone account for vector database
- Firestore database for user profiles and matches
- Pub/Sub topics configured for streaming updates

## Dependencies

The pipelines require the following main dependencies:

```
apache-beam[gcp]>=2.46.0
google-cloud-firestore>=2.11.0
google-cloud-pubsub>=2.28.0
google-cloud-secret-manager>=2.16.0
pinecone[grpc]>=5.4.2
openai>=1.3.0
sentence-transformers>=2.7.0
```

## Setup and Deployment

### 1. Configuration

Update the configuration in `scripts/deploy_flex_templates.sh`:

```bash
# GCP Project ID
PROJECT_ID="your-project-id"

# GCP Region
REGION="your-region"

# Google Cloud Storage Bucket Name
BUCKET_NAME="your-bucket-name"
```

### 2. Deploy Flex Templates

Run the deployment script to build Docker containers and deploy the flex templates:

```bash
cd vite-ts/dataflow
./scripts/deploy_flex_templates.sh
```

This will:
- Build Docker images for both pipelines
- Push the images to Google Container Registry
- Create Dataflow flex templates
- Configure the templates with default parameters

### 3. Streaming deployment preflight

Before the streaming deploy script builds or launches the Flex Template, it runs:

```bash
python3 dataflow/pipelines/streaming/scripts/preflight_deploy.py \
  --project "your-project-id" \
  --region "your-region" \
  --service-account-email "dataflow-worker@your-project-id.iam.gserviceaccount.com" \
  --immediate-topic "user-profile-updated" \
  --delayed-topic "delayed-matching" \
  --tasks-location "your-region" \
  --delayed-matching-queue "delayed-matching" \
  --notification-queue "match-notifications" \
  --voice-agent-queue "voice-agent-calls" \
  --pdf-bucket "your-instructions-bucket" \
  --pdf-instructions-path "agent-instructions-1.0.pdf" \
  --notification-function-url "https://example.com/notify" \
  --voice-agent-function-url "https://example.com/voice" \
  --pinecone-index "user-embeddings" \
  --pinecone-region "us-west1-gcp"
```

The preflight checks required commands, placeholder values, Secret Manager secret
metadata (`OPENAI_API_KEY`, `PINECONE_API_KEY`), Pub/Sub topics, Cloud Tasks
queues, the Dataflow worker service account, and the reranker instructions PDF in
GCS. It does not read or print secret values.

### 4. Run the Pipelines

#### Streaming Pipeline

To launch the streaming pipeline:

```bash
gcloud dataflow flex-template run "user-matching-streaming-$(date +%Y%m%d-%H%M%S)" \
    --project="your-project-id" \
    --region="your-region" \
    --template-file-gcs-location="gs://your-bucket/templates/streaming-pipeline.json" \
    --service-account-email="dataflow-worker@your-project-id.iam.gserviceaccount.com" \
    --staging-location="gs://your-bucket/dataflow/streaming/staging" \
    --temp-location="gs://your-bucket/dataflow/streaming/temp" \
    --parameters project="your-project-id" \
    --parameters region="your-region" \
    --parameters runner="DataflowRunner" \
    --parameters temp_location="gs://your-bucket/dataflow/streaming/temp" \
    --parameters staging_location="gs://your-bucket/dataflow/streaming/staging" \
    --parameters service_account_email="dataflow-worker@your-project-id.iam.gserviceaccount.com" \
    --parameters requirements_file="/template/requirements.txt" \
    --parameters user_profile_updated_pubsub_topic="projects/your-project-id/topics/user-profile-updated" \
    --parameters delayed_matching_pubsub_topic="projects/your-project-id/topics/delayed-matching" \
    --parameters pinecone_region="us-west1-gcp" \
    --parameters pinecone_index="user-embeddings" \
    --parameters pdf_bucket="your-instructions-bucket" \
    --parameters notification_function_url="https://example.com/notify" \
    --parameters voice_agent_function_url="https://example.com/voice" \
    --parameters dlq_gcs_path="gs://your-bucket/dataflow/streaming/dlq/" \
    --parameters top_k="50"
```

#### Batch Pipeline

To launch the batch pipeline:

```bash
gcloud dataflow flex-template run "user-matching-batch-$(date +%Y%m%d-%H%M%S)" \
    --project="your-project-id" \
    --region="your-region" \
    --template-file-gcs-location="gs://your-bucket/templates/batch-pipeline.json" \
    --parameters="pinecone_region=us-west1-gcp,pinecone_index=user-embeddings,top_k=50"
```

## Testing the Pipelines

### Runtime import smoke

Before building or deploying the streaming Flex Template, install the streaming
requirements in the same Python environment that will build the template and run:

```bash
python3 dataflow/pipelines/streaming/scripts/runtime_smoke.py
```

This checks import-time dependencies such as `apache_beam`, Google Cloud SDK
clients, Pinecone, OpenAI, `sentence_transformers`, and `PyPDF2` without
initializing cloud clients or downloading model weights. The streaming pipeline
Dockerfile runs `python scripts/runtime_smoke.py` during image build, and the
backend production readiness GitHub Action runs the repository-level smoke after
installing `dataflow/pipelines/streaming/requirements.txt`, so missing runtime
packages fail before deployment.

### Generate Test Profiles

Generate test profile data:

```bash
python scripts/create_test_profiles.py
```

### Simulate Streaming Updates

To test the streaming pipeline with simulated profile updates:

```bash
python scripts/simulate_streaming_updates.py
```

## Monitoring

Monitor your Dataflow jobs through the Google Cloud Console:

1. Go to the Dataflow section in GCP Console
2. Select your project
3. View pipeline metrics, logs, and execution graphs
4. Use Cloud Monitoring to create alerts for pipeline errors

## Security

This module accesses sensitive information (API keys, etc.) using Google Secret Manager. Ensure your deployment has proper IAM permissions to access these secrets.

## Contributing

When modifying the pipelines:

1. Test changes locally using DirectRunner
2. Update requirements.txt if adding dependencies
3. Update the Dockerfile if configuration changes are needed
4. Re-deploy the flex templates using the deployment script
5. Test on a small dataset before processing production data

## License

This Dataflow module is part of the Marriage AI Platform and is subject to the same licensing terms as specified in the root-level LICENSE file. 