# Use the official Python image as the base
FROM gcr.io/dataflow-templates-base/python3-template-launcher-base

# Location to store the pipeline artifacts.
ARG WORKDIR=/template
WORKDIR ${WORKDIR}

ENV FLEX_TEMPLATE_PYTHON_PY_FILE="${WORKDIR}/streaming.py"
ENV FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE="${WORKDIR}/requirements.txt"

# Copy the pipeline files and package directories required at launch/runtime.
COPY streaming.py .
COPY requirements.txt .
COPY utils.py .
COPY ./common ./common
COPY ./transforms ./transforms
COPY ./utils ./utils
COPY ./scripts ./scripts

# Install dependencies, prebuild the worker requirements cache, and fail fast if
# import-time runtime dependencies are missing from the template image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libffi-dev git \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r ${WORKDIR}/requirements.txt \
    && pip download --no-cache-dir --dest /tmp/dataflow-requirements-cache -r ${WORKDIR}/requirements.txt \
    && python scripts/runtime_smoke.py

ENTRYPOINT ["/opt/google/dataflow/python_template_launcher"]
