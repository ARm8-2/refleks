# Sanitized KovaaK's fixture

This directory contains only repository-owned synthetic game data. The
launcher points `REFLEKS_KOVAAKS_INSTALL_DIR` here and supplies synthetic Steam
identity variables so acceptance runs cannot inspect the developer's Steam or
KovaaK's installation.

The Stats CSV covers populated History, a long scenario name, locale-sensitive
dates and numbers, and Replay unavailable because no replay file is supplied.
An empty History state is available before the fixture is ingested. States that
cannot be produced deterministically by a Stats file use typed component DTOs.
