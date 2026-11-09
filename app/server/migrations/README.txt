Per-tool SQL migrations, applied once each at boot by db.migrate_sql(), in numeric order.

  NNN_<tool>.sql     e.g. 100_api_tester.sql (C 100-199, D 200-299, E 300-399 … K 1000-1099)

Default storage is JSON in workspaces.state: add a file here only if a tool needs real tables.
Use CREATE TABLE IF NOT EXISTS, prefix tables with the tool (api_tester_*), never edit a shipped file.
Tool owners may add their own NNN_<tool>.sql here (the folder is B's, the files are yours).
