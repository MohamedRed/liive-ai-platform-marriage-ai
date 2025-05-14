import logging
# utils.py - Common utility functions for the pipeline

def access_secret(project_id: str, secret_name: str) -> str:
    """Fetch secret from GCP Secret Manager"""
    # Import here to avoid making secretmanager a top-level dependency everywhere
    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{project_id}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
         # Log the error appropriately
         logging.getLogger(__name__).error(f"Failed to access secret {secret_name}: {e}", exc_info=True)
         # Depending on the use case, you might raise the error,
         # return None, or return a default value. Raising is often safest.
         raise RuntimeError(f"Failed to access secret {secret_name}") from e

# Add other pipeline-wide utility functions here if needed 