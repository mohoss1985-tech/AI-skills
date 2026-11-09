"""Rebuild the SQL runner's sample database (owner D).

    python3 app/server/tools/sample/build_cards_db.py           # cards.db + web/data/cards-sample.sql
    python3 app/server/tools/sample/build_cards_db.py --check   # also run the sample questions, print their answers

cards-sample.sql (next to this file) is the single source. The server opens cards.db read-only and rebuilds it
on its own when the .sql is newer, so running this script is optional.
"""

import sqlite3
import sys
from pathlib import Path

SERVER = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(SERVER))

from tools import sql_runner  # noqa: E402


def main(argv):
    path = sql_runner.build_db(force=True)
    conn = sqlite3.connect(path)
    counts = {t: conn.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
              for (t,) in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")}
    conn.close()
    print(f"built {path} ({path.stat().st_size // 1024} KB): " + ", ".join(f"{t} {n}" for t, n in counts.items()))
    print(f"copied seed to {sql_runner.WEB_SEED}")
    if "--check" in argv:
        res = sql_runner.run_sql("SELECT card_id, auth_id, stip FROM authorisations a JOIN cards c USING (card_id) "
                                 "WHERE c.status = 'blocked' AND a.response_code = '00' AND a.auth_ts > c.blocked_at")
        print("storyline:", res.get("rows"))
        print("write refused:", sql_runner.run_sql("DELETE FROM cards")["error"]["code"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
