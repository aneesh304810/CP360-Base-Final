"""Feed dictionary model — re-exports dataclasses from the connector."""
from .feed_dictionary_conn import (  # noqa: F401
    Enumeration, FeedDictionaryBundle, parse_data_type, extract_enumerations,
)
