# Use the official Python image as the base
FROM gcr.io/dataflow-templates-base/python3-template-launcher-base

# Location to store the pipeline artifacts.
ARG WORKDIR=/template
WORKDIR ${WORKDIR}

# Copy the pipeline files
COPY batch.py .
COPY requirements.txt .

# Install dependencies
RUN apt-get update \
    # Install any apt packages if required by your template pipeline.
    && apt-get install -y libffi-dev git \
    && rm -rf /var/lib/apt/lists/* \
    # Upgrade pip and install the requirements.
    && pip install --no-cache-dir --upgrade pip \
    # Install dependencies from requirements file in the launch environment.
    && pip install --no-cache-dir -r $FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE \
    # When FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE  option is used,
    # then during Template launch Beam downloads dependencies
    # into a local requirements cache folder and stages the cache to workers.
    # To speed up Flex Template launch, pre-download the requirements cache
    # when creating the Template.
    && pip download --no-cache-dir --dest /tmp/dataflow-requirements-cache -r $FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE

# Set the entry point
ENV FLEX_TEMPLATE_PYTHON_PY_FILE="${WORKDIR}/batch.py"
ENV FLEX_TEMPLATE_PYTHON_REQUIREMENTS_FILE="${WORKDIR}/requirements.txt"

ENTRYPOINT ["/opt/google/dataflow/python_template_launcher"] 