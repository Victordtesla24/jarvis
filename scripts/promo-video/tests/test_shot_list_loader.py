"""Tests for lib/shot_list_loader.py (R-33 schema validation + caching).

Covers:
  * duration sum mismatch
  * missing required scene field
  * missing required vo_line field
  * scenes_by_act filtering
  * _cache singleton + load_copy isolation
  * malformed JSON

Dual-compatible: runs under both `pytest` and `python -m unittest`.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Make scripts/promo-video importable.
_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_ROOT))

from lib import shot_list_loader  # noqa: E402


VALID = {
    "meta": {"duration_seconds": 6.0, "title": "t"},
    "scenes": [
        {"id": "s1", "act": 1, "start": 0.0, "duration": 3.0, "source": "live"},
        {"id": "s2", "act": 2, "start": 3.0, "duration": 3.0, "source": "ai"},
    ],
    "vo_lines": {
        "vo_01": {"text": "hello", "place_at": 0.5},
    },
}


class ShotListLoaderTests(unittest.TestCase):

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._orig_path = shot_list_loader.SHOT_LIST_PATH
        shot_list_loader._cache = None

    def tearDown(self) -> None:
        shot_list_loader.SHOT_LIST_PATH = self._orig_path
        shot_list_loader._cache = None
        self._tmp.cleanup()

    def _point_at(self, data) -> Path:
        p = Path(self._tmp.name) / "shot_list.json"
        if isinstance(data, (dict, list)):
            p.write_text(json.dumps(data))
        else:
            p.write_text(str(data))
        shot_list_loader.SHOT_LIST_PATH = p
        shot_list_loader._cache = None
        return p

    def test_duration_sum_mismatch(self) -> None:
        bad = {"meta": {"duration_seconds": 100.0},
               "scenes": [{"id": "s1", "act": 1, "start": 0.0,
                           "duration": 3.0, "source": "live"}],
               "vo_lines": {"vo_01": {"text": "x", "place_at": 0.0}}}
        self._point_at(bad)
        with self.assertRaises(shot_list_loader.ShotListError) as ctx:
            shot_list_loader.load()
        self.assertIn("duration_seconds", str(ctx.exception))

    def test_missing_scene_field(self) -> None:
        bad = {
            "meta": {"duration_seconds": 3.0},
            "scenes": [{"id": "s1", "act": 1, "start": 0.0, "duration": 3.0}],
            "vo_lines": {"vo_01": {"text": "x", "place_at": 0.0}},
        }
        self._point_at(bad)
        with self.assertRaises(shot_list_loader.ShotListError) as ctx:
            shot_list_loader.load()
        self.assertIn("source", str(ctx.exception))

    def test_missing_vo_field(self) -> None:
        bad = {
            "meta": {"duration_seconds": 3.0},
            "scenes": [{"id": "s1", "act": 1, "start": 0.0,
                        "duration": 3.0, "source": "live"}],
            "vo_lines": {"vo_01": {"text": "x"}},
        }
        self._point_at(bad)
        with self.assertRaises(shot_list_loader.ShotListError) as ctx:
            shot_list_loader.load()
        self.assertIn("place_at", str(ctx.exception))

    def test_scenes_by_act_filters(self) -> None:
        self._point_at(VALID)
        s1 = shot_list_loader.scenes_by_act(1)
        s2 = shot_list_loader.scenes_by_act(2)
        self.assertEqual(len(s1), 1)
        self.assertEqual(s1[0]["id"], "s1")
        self.assertEqual(len(s2), 1)
        self.assertEqual(s2[0]["id"], "s2")

    def test_cache_is_shared_but_load_copy_is_isolated(self) -> None:
        self._point_at(VALID)
        a = shot_list_loader.load()
        b = shot_list_loader.load()
        self.assertIs(a, b, "cache must be shared across calls")

        fresh = shot_list_loader.load_copy()
        self.assertIsNot(fresh, a)
        fresh["scenes"][0]["id"] = "mutated"
        self.assertEqual(a["scenes"][0]["id"], "s1",
                         "mutating the copy must not touch cache")

    def test_malformed_json_raises(self) -> None:
        self._point_at("{not valid json")
        with self.assertRaises(shot_list_loader.ShotListError) as ctx:
            shot_list_loader.load()
        self.assertIn("malformed", str(ctx.exception).lower())

    def test_unknown_vo_ref_raises(self) -> None:
        self._point_at(VALID)
        with self.assertRaises(shot_list_loader.ShotListError):
            shot_list_loader.vo_line("vo_nonexistent")


if __name__ == "__main__":
    unittest.main()
