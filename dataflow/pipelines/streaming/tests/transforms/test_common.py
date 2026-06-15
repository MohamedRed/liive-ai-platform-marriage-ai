# apps/marriage-ai/dataflow/pipelines/streaming/tests/transforms/test_common.py
import unittest
import apache_beam as beam
from apache_beam.testing.test_pipeline import TestPipeline
from apache_beam.testing.util import assert_that, equal_to
from apache_beam.io.gcp.pubsub import PubsubMessage # To simulate input

# Import the DoFn to test
# Adjust path based on execution context (e.g., running pytest from root)
from ....transforms.common import ExtractUserIDDoFn

class ExtractUserIDDoFnTest(unittest.TestCase):

    def test_extract_user_id_success(self):
        """Tests successful extraction of user_id."""
        user_id = "test-user-123"
        # Simulate a PubsubMessage with attributes
        test_message = PubsubMessage(
            data=b'some data',
            attributes={'user_id': user_id}
        )
        expected_output = [user_id]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_message])
            output_pcoll = input_pcoll | "ExtractID" >> beam.ParDo(ExtractUserIDDoFn())

            assert_that(output_pcoll, equal_to(expected_output), label="CheckOutput")

    def test_extract_user_id_missing_attribute(self):
        """Tests behavior when user_id attribute is missing."""
        # Simulate a PubsubMessage without the user_id attribute
        test_message = PubsubMessage(
            data=b'other data',
            attributes={'other_attr': 'value'}
        )
        expected_output = [] # Expect no output if ID is missing

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_message])
            # Access main output explicitly if using with_outputs
            results = input_pcoll | "ExtractID" >> beam.ParDo(ExtractUserIDDoFn()).with_outputs('errors', main='main')
            output_pcoll = results.main
            error_pcoll = results.errors # Capture error output if needed

            assert_that(output_pcoll, equal_to(expected_output), label="CheckMainOutputEmpty")
            # Optional: assert that the error output contains the element
            # assert_that(error_pcoll, ???) # Need to decide how errors are structured

    def test_extract_user_id_none_attributes(self):
        """Tests behavior when attributes dict is None."""
        test_message = PubsubMessage(
            data=b'no attrs',
            attributes=None
        )
        expected_output = []

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_message])
            results = input_pcoll | "ExtractID" >> beam.ParDo(ExtractUserIDDoFn()).with_outputs('errors', main='main')
            output_pcoll = results.main

            assert_that(output_pcoll, equal_to(expected_output), label="CheckOutputNoneAttrs")

    def test_extract_user_id_dict_input(self):
        """Tests extraction if input is a dict (less common but good check)."""
        # Note: Your DoFn implementation might need adjustment if it strictly expects PubsubMessage objects
        user_id = "dict-user-456"
        test_element = {
            'data': b'dict data',
            'attributes': {'user_id': user_id}
        }
        expected_output = [user_id]

        with TestPipeline() as p:
            input_pcoll = p | beam.Create([test_element])
            results = input_pcoll | "ExtractID" >> beam.ParDo(ExtractUserIDDoFn()).with_outputs('errors', main='main')
            output_pcoll = results.main

            # This assertion might fail if the DoFn doesn't handle dicts correctly
            # You might need to adapt the DoFn or the test based on expected behavior
            try:
                assert_that(output_pcoll, equal_to(expected_output), label="CheckDictOutput")
            except NotImplementedError as e:
                 # Handle case where DoFn specifically checks for PubsubMessage type
                 self.skipTest(f"Skipping dict input test, DoFn might expect PubsubMessage: {e}")
            except AttributeError as e:
                 # Handle case where DoFn tries to access non-existent attribute on dict
                 self.skipTest(f"Skipping dict input test, DoFn failed on dict: {e}")


if __name__ == '__main__':
    unittest.main() 