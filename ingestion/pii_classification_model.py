"""PII classification model — re-exports dataclasses from the connector."""
from .pii_classification_conn import (  # noqa: F401
    PiiClassification, PiiBundle, SENSITIVITY_ORDINAL, normalize,
)
